import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaPython from '@aws-cdk/aws-lambda-python-alpha';
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from 'aws-cdk-lib/aws-iam';

import { NodejsBuild } from 'deploy-time-build';
import * as path from 'path';

import { Cognito } from './constructs/backend-cognito';
import { ApiGateway } from './constructs/backend-apigateway';
import { WorkflowRunner } from './constructs/backend-workflow-runner';
import { DynamoDb } from './constructs/backend-dynamodb';
import { CloudFront } from './constructs/frontend-cloudfront';
import { Waf } from './constructs/waf';

/** {@link OmicsAnalysisAppStack} のパラメーター */
export interface OmicsAnalysisAppStackProps extends cdk.StackProps {
  /** フロントエンドとバックエンドへの接続を許可する IP アドレスの CIDR */
  ipv4Ranges?: string[];
  ipv6Ranges?: string[];

  /** QuickSight のサインアップを行ったリージョン */
  quickSightIdentityRegion?: string;
  /** QuickSight ユーザーの名前空間 */
  quickSightUserNamespace?: string;
}

/** AWS HealthOmics Analysis App を構築する CDK スタック */
export class OmicsAnalysisAppStack extends cdk.Stack {
  readonly cognito: Cognito;
  readonly dynamoDb: DynamoDb;
  readonly workflowRunner: WorkflowRunner;
  readonly apiGateway: ApiGateway;
  readonly backendWaf?: Waf;

  readonly cloudfront: CloudFront;
  readonly frontendWaf?: Waf;

  readonly commonLayer: lambdaPython.PythonLayerVersion;

  /**
   * {@link OmicsAnalysisAppStack} をデプロイする
   * @param scope スタックのスコープ
   * @param id スタックの ID
   * @param props パラメーター
   */
  constructor(scope: Construct, id: string, props: OmicsAnalysisAppStackProps) {
    super(scope, id, props);

    // Lambda 関数が共通で利用するライブラリをまとめた Lambda レイヤーを作成する
    this.commonLayer = new lambdaPython.PythonLayerVersion(this, 'CommonLayer', {
      // 依存ライブラリを定義した requirements.txt が存在する相対パスを指定
      entry: path.resolve(__dirname, '../../backend/lambda/layers/Common'),
      // 対応するランタイムとして Python 3.9 を指定
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_9],
      // 対応するアーキテクチャとして x64_64 を指定
      compatibleArchitectures: [lambda.Architecture.X86_64]
    });

    // Cognito ユーザープールと関連リソースを作成
    this.cognito = new Cognito(this, 'Cognito', {
      quickSightIdentityRegion: props.quickSightIdentityRegion,
      quickSightUserNamespace: props.quickSightUserNamespace,
      commonLayer: this.commonLayer,
    });

    // Cognito ユーザープールのリージョンを CloudFormation スタックの出力に追加
    new cdk.CfnOutput(this, 'CognitoUserPoolRegion', {
      value: this.cognito.userPool.env.region,
    });

    // Cognito ユーザープールの ID を CloudFormation スタックの出力に追加
    new cdk.CfnOutput(this, "CognitoUserPoolId", {
      value: this.cognito.userPool.userPoolId,
    });

    // Cognito ユーザープールクライアントの ID を CloudFormation スタックの出力に追加
    new cdk.CfnOutput(this, "CognitoUserPoolClientId", {
      value: this.cognito.userPoolClient.userPoolClientId,
    });

    // Omics ワークフローの実行結果の出力先となる S3 バケットを作成する
    const s3BucketForOutput = new s3.Bucket(this, 'OutputBucket', {
      // CDK でデプロイしたものを削除する際、バケットも連動して削除する設定
      // (意図せず削除してしまう可能性があるため、本番環境で DESTROY を使用するのはお勧めしません)
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,

      // バケットへのパブリックアクセスを全てブロックする
      // https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,

      // Amazon S3 マネージド キーを使ったバケットの暗号化を有効化する
      // https://docs.aws.amazon.com/AmazonS3/latest/userguide/default-bucket-encryption.html
      encryption: s3.BucketEncryption.S3_MANAGED,

      // バケットへのアクセスに SSL を必須にする
      enforceSSL: true,
    });
    // ワークフロー実行結果の出力先バケットの S3 URI を CloudFormation スタックの出力に追加
    new cdk.CfnOutput(this, "WorkflowOutputBucketURI", {
      value: s3BucketForOutput.s3UrlForObject(),
    });

    // Step Functions による追加処理の結果を保存する DynamoDB テーブルを作成する
    this.dynamoDb = new DynamoDb(this, 'DynamoDb', {
    });
    // DynamoDB の WorkflowVisualizers テーブルの名前を CloudFormation スタックの出力に追加
    new cdk.CfnOutput(this, "DynamoDbWorkflowVisualizersTableName", {
      value: this.dynamoDb.workflowVisualizersTable.tableName,
    });
    // DynamoDB の RunVisualizations テーブルの名前を CloudFormation スタックの出力に追加
    new cdk.CfnOutput(this, "DynamoDbRunVisualizationsTableName", {
      value: this.dynamoDb.runVisualizationsTable.tableName,
    });

    const stageName = cdk.Stage.of(this)?.stageName;

    // Omics ワークフローを実行するための IAM ロールを作成する
    const omicsWorkflowRunRole = new iam.Role(this, 'OmicsWorkflowRunRole', {
      roleName: `${stageName ?? ''}OmicsWorkflowRunRole`,
      assumedBy: new iam.ServicePrincipal('omics.amazonaws.com', {
        conditions: {
          'StringEquals': {
            'aws:SourceAccount': cdk.Stack.of(this).account,
          },
          'ArnLike': {
            'aws:SourceArn': cdk.Stack.of(this).formatArn({
              service: 'omics',
              resource: 'run',
              resourceName: '*',
            }),
          },
        },
      }),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryReadOnly'),
      ],
      inlinePolicies: {
        'WriteLogs': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogGroup',
              ],
              resources: [
                cdk.Stack.of(this).formatArn({
                  service: 'logs',
                  resource: 'log-group',
                  resourceName: '/aws/omics/WorkflowLog:*',
                  arnFormat: cdk.ArnFormat.COLON_RESOURCE_NAME,
                }),
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogStream',
                'logs:DescribeLogStreams',
                'logs:PutLogEvents',
              ],
              resources: [
                cdk.Stack.of(this).formatArn({
                  service: 'logs',
                  resource: 'log-group',
                  resourceName: '/aws/omics/WorkflowLog:log-stream:*',
                  arnFormat: cdk.ArnFormat.COLON_RESOURCE_NAME,
                }),
              ],
            }),
          ],
        }),
      },
    });
    s3BucketForOutput.grantReadWrite(omicsWorkflowRunRole);

    // ワークフローに後処理や後処理を追加するための Step Functions ステートマシンを作成
    this.workflowRunner = new WorkflowRunner(this, 'WorkflowRunner', {
      commonLayer: this.commonLayer,
    });
    // ステートマシンの実行ロールの ARN を CloudFormation スタックの出力に追加
    new cdk.CfnOutput(this, "WorkflowRunnerStateMachineRoleArn", {
      value: this.workflowRunner.stateMachine.role.roleArn,
      exportName: `${stageName ?? ''}OmicsWorkflowRunnerRoleArn`,
    });

    // フロントエンドへのアクセスを制限する Web ACLを作成
    if (props.ipv4Ranges || props.ipv6Ranges) {
      this.frontendWaf = new Waf(this, 'FrontendWaf', {
        ipv4Ranges: props.ipv4Ranges,
        ipv6Ranges: props.ipv6Ranges,
        scope: 'CLOUDFRONT',
      });
    }

    // フロントエンドのアセットを配信する CloudFront を作成
    this.cloudfront = new CloudFront(this, 'CloudFront', {
      webAclId: this.frontendWaf?.webAcl?.attrArn,
    });

    // フロントエンドの URL を CloudFormation スタックの出力に追加
    new cdk.CfnOutput(this, 'FrontendURL', {
      value: this.cloudfront.url,
    });

    // フロントエンドのアセットを格納する S3 バケット名を CloudFormation スタックの出力に追加
    new cdk.CfnOutput(this, 'FrontendBucket', {
      value: this.cloudfront.assetBucket.s3UrlForObject(),
    });

    // CloudFront へのアクセスログを格納する S3 バケット名を CloudFormation スタックの出力に追加
    new cdk.CfnOutput(this, 'FrontendAccessLogBucket', {
      value: this.cloudfront.accessLogBucket.s3UrlForObject(),
    });

    s3BucketForOutput.addCorsRule({
      allowedOrigins: [this.cloudfront.url],
      allowedMethods: [s3.HttpMethods.GET],
    });

    // API Gateway REST API と関連りソースを作成
    this.apiGateway = new ApiGateway(this, 'ApiGateway', {
      userPool: this.cognito.userPool,
      layer: this.commonLayer,
      allowOrigin: this.cloudfront.url,
    });

    // バックエンド API の URL を CloudFormation スタックの出力に追加
    new cdk.CfnOutput(this, "BackendApiURL", {
      value: this.apiGateway.restApi.url,
    });

    // API Gateway に REST API の定義を追加
    this.apiGateway.addWorkflowsApi();
    this.apiGateway.addWorkflowVisualizersApi(this.dynamoDb);
    this.apiGateway.addStartAnalysisApi(s3BucketForOutput, omicsWorkflowRunRole, this.workflowRunner, this.dynamoDb);
    this.apiGateway.addRunsApi();
    this.apiGateway.addRunTasksApi();
    this.apiGateway.addTaskLogApi();
    this.apiGateway.addRunOutputsApi();
    this.apiGateway.addDeleteRunApi();
    this.apiGateway.addRunVisualizationsApi(this.dynamoDb);
    if (props.quickSightIdentityRegion && props.quickSightUserNamespace) {
      this.apiGateway.addVisualizationDashboardApi(props.quickSightIdentityRegion, props.quickSightUserNamespace, this.cognito, this.dynamoDb);
    }

    // バックエンド API へのアクセスを制限する Web ACL を作成
    if (props.ipv4Ranges || props.ipv6Ranges) {
      this.backendWaf = new Waf(this, 'BackendWaf', {
        ipv4Ranges: props.ipv4Ranges,
        ipv6Ranges: props.ipv6Ranges,
        scope: 'REGIONAL',
      });

      // Web ACL を API Gateway に設定する
      new wafv2.CfnWebACLAssociation(this, "WebAclAssociationRestApi", {
        webAclArn: this.backendWaf.webAcl.attrArn,
        resourceArn: this.apiGateway.restApi.deploymentStage.stageArn,
      });

      // Web ACL を Cognito ユーザープールに設定する
      new wafv2.CfnWebACLAssociation(this, "WebAclAssociationUserPool", {
        webAclArn: this.backendWaf.webAcl.attrArn,
        resourceArn: this.cognito.userPool.userPoolArn,
      });
    }

    // フロントエンドのアセットをビルドし、S3 バケットにアップロードする
    new NodejsBuild(this, 'NodejsBuild', {
      assets: [
        // フロントエンドのソースコードの場所を指定
        {
          path: path.join(__dirname, '../../frontend'),
          exclude: [
            'dist',
            'node_modules'
          ],
        },
      ],
      outputSourceDirectory: 'dist/spa',

      // ビルド時の環境変数に各種設定を反映する
      buildEnvironment: {
        // バックエンド API の URL
        VITE_API_URL: this.apiGateway.restApi.url,
        // Cognito ユーザープールがデプロイされたリージョン
        VITE_AUTH_REGION: this.cognito.userPool.env.region,
        // Cognito ユーザープール ID
        VITE_AUTH_USER_POOL_ID: this.cognito.userPool.userPoolId,
        // Cognito ユーザープールクライアントの ID
        VITE_AUTH_WEB_CLIENT_ID: this.cognito.userPoolClient.userPoolClientId,
      },

      // ビルドを実行する Node.js のバージョンを指定
      nodejsVersion: 18,

      // ビルドを実行するためのコマンド
      buildCommands: [
        'npm ci',
        'npm run build'
      ],

      // アップロード先の S3 バケット
      destinationBucket: this.cloudfront.assetBucket,

      // アップロード完了後、新しいアセットを即時反映するために CloudFront のキャッシュを消すための設定
      // 参考: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_s3_deployment.BucketDeployment.html
      distribution: this.cloudfront.distribution,
    });
  }
}
