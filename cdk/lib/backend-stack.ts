import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaPython from '@aws-cdk/aws-lambda-python-alpha';
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from 'aws-cdk-lib/aws-iam';

import * as path from 'path';

import { Cognito } from './constructs/backend-cognito';
import { ApiGateway } from './constructs/backend-apigateway';
import { WorkflowRunner } from './constructs/backend-workflow-runner';
import { DynamoDb } from './constructs/backend-dynamodb';
import { Waf } from './constructs/waf';

/** {@link BackendStack} のパラメーター */
export interface BackendStackProps extends cdk.StackProps {
  /** バックエンド API への接続を許可する IP アドレスの CIDR */
  ipv4Ranges: string[] | undefined;
  ipv6Ranges: string[] | undefined;
}

/** バックエンドを構築する CDK スタック */
export class BackendStack extends cdk.Stack {
  readonly cognito: Cognito;
  readonly dynamoDb: DynamoDb;
  readonly workflowRunner: WorkflowRunner;
  readonly apiGateway: ApiGateway;
  readonly waf?: Waf;

  readonly commonLayer: lambdaPython.PythonLayerVersion;

  /**
   * {@link BackendStack} をデプロイする
   * @param scope スタックのスコープ
   * @param id スタックの ID
   * @param props パラメーター
   */
  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props);

    // Cognito ユーザープールと関連リソースを作成
    this.cognito = new Cognito(this, 'Cognito', {
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

    // cdk.json で指定された各種 S3 バケットの情報を CDK に取り込む
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

    // Lambda 関数が共通で利用するライブラリをまとめた Lambda レイヤーを作成する
    this.commonLayer = new lambdaPython.PythonLayerVersion(this, 'CommonLayer', {
      // 依存ライブラリを定義した requirements.txt が存在する相対パスを指定
      entry: path.resolve(__dirname, '../../backend/lambda/layers/Common'),
      // 対応するランタイムとして Python 3.9 を指定
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_9],
      // 対応するアーキテクチャとして x64_64 を指定
      compatibleArchitectures: [lambda.Architecture.X86_64]
    });

    // Step Functions による追加処理の結果を保存する DynamoDB テーブルを作成する
    this.dynamoDb = new DynamoDb(this, 'DynamoDb', {
    });
    // DynamoDB の Visualizations テーブルの名前を CloudFormation スタックの出力に追加
    new cdk.CfnOutput(this, "DynamoDbVisualizationsTableName", {
      value: this.dynamoDb.visualizationsTable.tableName,
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

    // API Gateway REST API と関連りソースを作成
    this.apiGateway = new ApiGateway(this, 'ApiGateway', {
      userPool: this.cognito.userPool,
    });

    // バックエンド API の URL を CloudFormation スタックの出力に追加
    new cdk.CfnOutput(this, "BackendApiURL", {
      value: this.apiGateway.restApi.url,
    });

    // API Gateway に REST API の定義を追加
    this.apiGateway.addWorkflowsApi(this.commonLayer);
    this.apiGateway.addWorkflowVisualizationsApi(this.dynamoDb, this.commonLayer);
    this.apiGateway.addStartAnalysisApi(s3BucketForOutput, omicsWorkflowRunRole, this.workflowRunner, this.dynamoDb, this.commonLayer);
    this.apiGateway.addRunsApi(this.commonLayer);
    this.apiGateway.addRunTasksApi(this.commonLayer);
    this.apiGateway.addTaskLogApi(this.commonLayer);
    this.apiGateway.addRunOutputsApi(this.commonLayer);
    this.apiGateway.addDeleteRunApi(this.commonLayer);

    // バックエンド API へのアクセスを制限する Web ACL を作成
    if (props.ipv4Ranges || props.ipv6Ranges) {
      this.waf = new Waf(this, 'Waf', {
        ipv4Ranges: props.ipv4Ranges,
        ipv6Ranges: props.ipv6Ranges,
        scope: 'REGIONAL',
      });

      // Web ACL を API Gateway に設定する
      new wafv2.CfnWebACLAssociation(this, "WebAclAssociationRestApi", {
        webAclArn: this.waf.webAcl.attrArn,
        resourceArn: this.apiGateway.restApi.deploymentStage.stageArn,
      });

      // Web ACL を Cognito ユーザープールに設定する
      new wafv2.CfnWebACLAssociation(this, "WebAclAssociationUserPool", {
        webAclArn: this.waf.webAcl.attrArn,
        resourceArn: this.cognito.userPool.userPoolArn,
      });
    }
  }
}
