import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaPython from '@aws-cdk/aws-lambda-python-alpha';
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';

import * as path from 'path';

import { Cognito } from "./backend-cognito";
import { DynamoDb } from "./backend-dynamodb";
import { WorkflowRunner } from "./backend-workflow-runner";

/** {@link ApiGateway} コンストラクトのパラメーター */
export interface ApiGatewayProps {
  /** ユーザー認証に使う Cognito ユーザープール */
  userPool: cognito.IUserPool;

  /** Lambda 関数が利用する Lambda レイヤー */
  layer: lambda.ILayerVersion;

  /** CORS の Allow-Origin */
  allowOrigin: string;
}

/**
 * API Gateway を構築する CDK コンストラクト
 */
export class ApiGateway extends Construct {
  /** API Gateway REST API */
  readonly restApi: apigw.RestApi;

  /** Lambda 関数が利用する Lambda レイヤー */
  readonly layer: lambda.ILayerVersion;

  /** CORS の Allow-Origin */
  readonly allowOrigin: string;

  /**
   * {@link ApiGateway} コンストラクトを作成する
   * @param scope コンストラクトのスコープ
   * @param id コンストラクトの ID
   * @param props パラメーター
   */
  constructor(scope: Construct, id: string, props: ApiGatewayProps) {
    super(scope, id);

    this.layer = props.layer;
    this.allowOrigin = props.allowOrigin;

    // API Gateway へのアクセスログを記録する CloudWatch Logs ロググループを作成する
    const apiLogGroup = new logs.LogGroup(this, 'RestApiLogGroup', {
      retention: logs.RetentionDays.ONE_YEAR,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // API Gateway の Cognito オーソライザーを作成する
    const authorizer = new apigw.CognitoUserPoolsAuthorizer(this, 'RestApiAuthorizer', {
      cognitoUserPools: [props.userPool],
    });

    const stageName = cdk.Stage.of(this)?.stageName;

    // API Gateway REST API を作成する
    this.restApi = new apigw.RestApi(this, 'RestApi', {
      restApiName: `${stageName ?? ''}OmicsBackendApi`,
      endpointTypes: [apigw.EndpointType.REGIONAL], // リージョン内にエンドポイントを立てる一般的な方式とする

      deployOptions: {
        stageName: 'v1', // ルートパス名を `v1` とする
        loggingLevel: apigw.MethodLoggingLevel.INFO, // CloudWatch Logs のログレベルを INFO とする
        accessLogDestination: new apigw.LogGroupLogDestination(apiLogGroup), // アクセスログの出力先を CloudWatch Logs とする
        accessLogFormat: apigw.AccessLogFormat.jsonWithStandardFields(), // アクセスログの形式を JSON 形式に指定
        tracingEnabled: true, // AWS X-Ray によるトレースを有効にする
      },

      cloudWatchRole: true, // CloudWatch Logs にログを出力するための IAM ロールを自動作成する

      defaultCorsPreflightOptions: {
        allowOrigins: [this.allowOrigin], // REST API への接続元 Origin に特別な制限を設けない (テスト用の設定)
      },

      // REST API のデフォルト認証方法を Cognito 認証とする
      defaultMethodOptions: {
        authorizer: authorizer,
        authorizationType: apigw.AuthorizationType.COGNITO,
      },
    });
  }

  /**
   * ワークフローに関する情報を取得する API を作成する
   * `GET /workflows/{workflowType}`
   * `GET /workflows/{workflowType}/{workflowId}`
   */
  addWorkflowsApi() {
    // API を実装した Lambda 関数を作成する
    const workflowsApiFunction = new lambdaPython.PythonFunction(this, 'WorkflowsApiFunction', {
      // エントリポイントとなる index.py が存在するディレクトリの相対パスを指定
      entry: path.resolve(__dirname, '../../../backend/lambda/functions/ApiGateway/WorkflowsApi'),
      // 利用するランタイムとして Python 3.9 を指定
      runtime: lambda.Runtime.PYTHON_3_9,
      // 利用するアーキテクチャとして x64_64 を指定
      architecture: lambda.Architecture.X86_64,

      // 利用可能なメモリサイズをデフォルトの 128MB から変更したい場合に指定
      // memorySize: 1024,

      // 利用可能なエフェメラルストレージのサイズをデフォルトの 512MB から変更したい場合に指定
      // ephemeralStorageSize: cdk.Size.gibibytes(1),

      // Lambda 関数が必要とする環境変数の設定
      environment: {
        CORS_ALLOW_ORIGIN: this.allowOrigin,
      },

      // Lambda 関数が利用するレイヤーの設定
      layers: [this.layer],

      // 実行タイムアウトを 30 秒に設定
      timeout: cdk.Duration.seconds(30),
      // AWS X-Ray による Lambda 関数の実行トレースを有効にする
      tracing: lambda.Tracing.ACTIVE
    });
    workflowsApiFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'omics:ListWorkflows',
        'omics:GetWorkflow',
      ],
      resources: ['*'],
    }));

    // API Gateway にルートを登録する
    const workflows = this.restApi.root.addResource('workflows');
    const workflowType = workflows.addResource('{workflowType}');
    workflowType.addMethod('GET', new apigw.LambdaIntegration(workflowsApiFunction));

    const workflow = workflowType.addResource('{workflowId}');
    workflow.addMethod('GET', new apigw.LambdaIntegration(workflowsApiFunction));
  }

  /**
   * ワークフローの可視化に関する情報を取得する API を作成する
   * `GET /workflows/{workflowType}/{workflowId}/visualizers`
   * `GET /workflows/{workflowType}/{workflowId}/visualizers/{visualizerId}`
   * @param dynamoDb DynamoDB テーブルを作成するコンストラクト
   */
  addWorkflowVisualizersApi(dynamoDb: DynamoDb) {
    // API を実装した Lambda 関数を作成する
    const workflowVisualizersApiFunction = new lambdaPython.PythonFunction(this, 'WorkflowVisualizersApiFunction', {
      entry: path.resolve(__dirname, '../../../backend/lambda/functions/ApiGateway/WorkflowVisualizersApi'),
      runtime: lambda.Runtime.PYTHON_3_9,
      architecture: lambda.Architecture.X86_64,

      // memorySize: 1024,
      // ephemeralStorageSize: cdk.Size.gibibytes(1),

      environment: {
        DYNAMODB_TABLE_NAME_WORKFLOW_VISUALIZERS: dynamoDb.workflowVisualizersTable.tableName,
        CORS_ALLOW_ORIGIN: this.allowOrigin,
      },

      layers: [this.layer],

      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE
    });
    dynamoDb.workflowVisualizersTable.grantReadData(workflowVisualizersApiFunction);

    // API Gateway にルートを登録する
    const workflow = this.restApi.root.getResource('workflows')!.getResource('{workflowType}')!.getResource('{workflowId}')!;
    const visualizers = workflow.addResource('visualizers');
    visualizers.addMethod('GET', new apigw.LambdaIntegration(workflowVisualizersApiFunction));

    const visualizer = visualizers.addResource('{visualizerId}');
    visualizer.addMethod('GET', new apigw.LambdaIntegration(workflowVisualizersApiFunction));
  }

  /**
   * 分析を実行する API を作成する
   * `POST /analyses`
   * @param s3BucketForOutput ワークフローの出力を格納する S3 バケット
   * @param workflowRunner Step Functions ステートマシンを作成するコンストラクト
   * @param dynamoDb DynamoDB テーブルを作成するコンストラクト
   */
  addStartAnalysisApi(s3BucketForOutput: s3.IBucket, omicsWorkflowRunRole: iam.IRole, workflowRunner: WorkflowRunner, dynamoDb: DynamoDb) {
    // API を実装した Lambda 関数を作成する
    const startAnalysisApiFunction = new lambdaPython.PythonFunction(this, 'StartAnalysisApiFunction', {
      entry: path.resolve(__dirname, '../../../backend/lambda/functions/ApiGateway/StartAnalysisApi'),
      runtime: lambda.Runtime.PYTHON_3_9,
      architecture: lambda.Architecture.X86_64,

      // memorySize: 1024,
      // ephemeralStorageSize: cdk.Size.gibibytes(1),

      environment: {
        OMICS_WORKFLOW_RUN_ROLE_ARN: omicsWorkflowRunRole.roleArn,
        OMICS_OUTPUT_BUCKET_URL: s3BucketForOutput.s3UrlForObject(),
        STEPFUNCTIONS_STATE_MACHINE_ARN: workflowRunner.stateMachine.stateMachineArn,
        DYNAMODB_TABLE_NAME_WORKFLOW_VISUALIZERS: dynamoDb.workflowVisualizersTable.tableName,
        STAGE_NAME: cdk.Stage.of(this)?.stageName ?? '',
        CORS_ALLOW_ORIGIN: this.allowOrigin,
      },

      layers: [this.layer],

      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE
    });
    startAnalysisApiFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'omics:GetWorkflow',
      ],
      resources: ['*'],
    }));
    workflowRunner.stateMachine.grantStartExecution(startAnalysisApiFunction);
    dynamoDb.workflowVisualizersTable.grantReadData(startAnalysisApiFunction);

    // API Gateway にルートを登録する
    const analyses = this.restApi.root.addResource('analyses');
    analyses.addMethod('POST', new apigw.LambdaIntegration(startAnalysisApiFunction));
  }

  /**
   * ワークフローの実行に関する情報を取得する API を作成する
   * `GET /runs`
   * `GET /runs/{runId}`
  */
  addRunsApi() {
    // API を実装した Lambda 関数を作成する
    const runsApiFunction = new lambdaPython.PythonFunction(this, 'RunsApiFunction', {
      entry: path.resolve(__dirname, '../../../backend/lambda/functions/ApiGateway/RunsApi'),
      runtime: lambda.Runtime.PYTHON_3_9,
      architecture: lambda.Architecture.X86_64,

      // memorySize: 1024,
      // ephemeralStorageSize: cdk.Size.gibibytes(1),

      environment: {
        CORS_ALLOW_ORIGIN: this.allowOrigin,
      },

      layers: [this.layer],

      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE
    });
    runsApiFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'omics:ListRuns',
        'omics:GetRun',
      ],
      resources: ['*'],
    }));

    // API Gateway にルートを登録する
    const runs = this.restApi.root.addResource('runs');
    runs.addMethod('GET', new apigw.LambdaIntegration(runsApiFunction));

    const run = runs.addResource('{runId}');
    run.addMethod('GET', new apigw.LambdaIntegration(runsApiFunction));
  }

  /**
   * ワークフロー実行のタスクに関する情報を取得する API を作成する
   * `GET /runs/{runId}/tasks`
   * `GET /runs/{runId}/tasks/{taskId}`
   */
  addRunTasksApi() {
    // API を実装した Lambda 関数を作成する
    const runTasksApiFunction = new lambdaPython.PythonFunction(this, 'RunTasksApiFunction', {
      entry: path.resolve(__dirname, '../../../backend/lambda/functions/ApiGateway/RunTasksApi'),
      runtime: lambda.Runtime.PYTHON_3_9,
      architecture: lambda.Architecture.X86_64,

      // memorySize: 1024,
      // ephemeralStorageSize: cdk.Size.gibibytes(1),

      environment: {
        CORS_ALLOW_ORIGIN: this.allowOrigin,
      },

      layers: [this.layer],

      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE
    });
    runTasksApiFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'omics:ListRunTasks',
        'omics:GetRunTask',
      ],
      resources: ['*'],
    }));

    // API Gateway にルートを登録する
    const run = this.restApi.root.getResource('runs')!.getResource('{runId}')!;
    const tasks = run.addResource('tasks');
    tasks.addMethod('GET', new apigw.LambdaIntegration(runTasksApiFunction));

    const task = tasks.addResource('{taskId}');
    task.addMethod('GET', new apigw.LambdaIntegration(runTasksApiFunction));
  }

  /**
   * タスクの実行ログを取得する API を作成する
   * `GET /runs/{runId}/tasks/{taskId}/log`
   */
  addTaskLogApi() {
    // API を実装した Lambda 関数を作成する
    const taskLogApiFunction = new lambdaPython.PythonFunction(this, 'TaskLogApiFunction', {
      entry: path.resolve(__dirname, '../../../backend/lambda/functions/ApiGateway/TaskLogApi'),
      runtime: lambda.Runtime.PYTHON_3_9,
      architecture: lambda.Architecture.X86_64,

      // memorySize: 1024,
      // ephemeralStorageSize: cdk.Size.gibibytes(1),

      environment: {
        CORS_ALLOW_ORIGIN: this.allowOrigin,
      },

      layers: [this.layer],

      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE
    });
    taskLogApiFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'omics:GetRunTask',
      ],
      resources: ['*'],
    }));
    taskLogApiFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:GetLogEvents',
      ],
      resources: ['*'],
    }));

    // API Gateway にルートを登録する
    const run = this.restApi.root.getResource('runs')!.getResource('{runId}')!;
    const task = run.getResource('tasks')!.getResource('{taskId}')!;
    const taskLog = task.addResource('log');
    taskLog.addMethod('GET', new apigw.LambdaIntegration(taskLogApiFunction));
  }

  /**
   * ワークフローの出力ファイルを取得する API を作成する
   * `GET /runs/{runId}/outputs`
   */
  addRunOutputsApi() {
    // API を実装した Lambda 関数を作成する
    const runOutputsApiFunction = new lambdaPython.PythonFunction(this, 'RunOutputsApiFunction', {
      entry: path.resolve(__dirname, '../../../backend/lambda/functions/ApiGateway/RunOutputsApi'),
      runtime: lambda.Runtime.PYTHON_3_9,
      architecture: lambda.Architecture.X86_64,

      // memorySize: 1024,
      // ephemeralStorageSize: cdk.Size.gibibytes(1),

      environment: {
        CORS_ALLOW_ORIGIN: this.allowOrigin,
      },

      layers: [this.layer],

      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE
    });
    runOutputsApiFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'omics:GetRun',
      ],
      resources: ['*'],
    }));
    runOutputsApiFunction.role?.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess')
    );

    // API Gateway にルートを登録する
    const run = this.restApi.root.getResource('runs')!.getResource('{runId}')!;
    const outputs = run.addResource('outputs');
    outputs.addMethod('GET', new apigw.LambdaIntegration(runOutputsApiFunction));

    const pathPlus = outputs.addResource('{path+}');
    pathPlus.addMethod('GET', new apigw.LambdaIntegration(runOutputsApiFunction));
  }

  /**
   * ワークフロー実行結果を削除する API を作成する
   * `DELETE /runs/{runId}`
   */
  addDeleteRunApi() {
    // API を実装した Lambda 関数を作成する
    const deleteRunApiFunction = new lambdaPython.PythonFunction(this, 'DeleteRunApiFunction', {
      entry: path.resolve(__dirname, '../../../backend/lambda/functions/ApiGateway/DeleteRunApi'),
      runtime: lambda.Runtime.PYTHON_3_9,
      architecture: lambda.Architecture.X86_64,

      // memorySize: 1024,
      // ephemeralStorageSize: cdk.Size.gibibytes(1),

      environment: {
        CORS_ALLOW_ORIGIN: this.allowOrigin,
      },

      layers: [this.layer],

      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE
    });
    deleteRunApiFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'omics:DeleteRun',
      ],
      resources: ['*'],
    }));

    // API Gateway にルートを登録する
    const run = this.restApi.root.getResource('runs')!.getResource('{runId}')!;
    run.addMethod('DELETE', new apigw.LambdaIntegration(deleteRunApiFunction));
  }

  /**
   * ワークフロー実行の可視化に関する情報を取得する API を作成する
   * `GET /runs/{runId}/visualizations`
   * `GET /runs/{runId}/visualizations/{visualizationId}`
   * @param dynamoDb DynamoDB テーブルを作成するコンストラクト
   */
  addRunVisualizationsApi(dynamoDb: DynamoDb) {
    // API を実装した Lambda 関数を作成する
    const runVisualizationsApiFunction = new lambdaPython.PythonFunction(this, 'RunVisualizationsApiFunction', {
      entry: path.resolve(__dirname, '../../../backend/lambda/functions/ApiGateway/RunVisualizationsApi'),
      runtime: lambda.Runtime.PYTHON_3_9,
      architecture: lambda.Architecture.X86_64,

      // memorySize: 1024,
      // ephemeralStorageSize: cdk.Size.gibibytes(1),

      environment: {
        DYNAMODB_TABLE_NAME_RUN_VISUALIZATIONS: dynamoDb.runVisualizationsTable.tableName,
        CORS_ALLOW_ORIGIN: this.allowOrigin,
      },

      layers: [this.layer],

      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE
    });
    dynamoDb.runVisualizationsTable.grantReadData(runVisualizationsApiFunction);

    // API Gateway にルートを登録する
    const run = this.restApi.root.getResource('runs')!.getResource('{runId}')!;
    const visualizations = run.addResource('visualizations');
    visualizations.addMethod('GET', new apigw.LambdaIntegration(runVisualizationsApiFunction));

    const visualization = visualizations.addResource('{visualizationId}');
    visualization.addMethod('GET', new apigw.LambdaIntegration(runVisualizationsApiFunction));
  }

  /**
   * ワークフローの出力を可視化するダッシュボードの URL を取得する API を作成する
   * `GET /runs/{runId}/visualizations/{visualizationId}/dashboard`
   * @param quickSightIdentityRegion QuickSight のサインアップを行ったリージョン
   * @param quickSightUserNamespace QuickSight ユーザーの名前空間
   * @param cognito Cognito ユーザープールを構築する CDK コンストラクト
   * @param dynamoDb DynamoDB テーブルを作成するコンストラクト
   */
  addVisualizationDashboardApi(quickSightIdentityRegion: string, quickSightUserNamespace: string, cognito: Cognito, dynamoDb: DynamoDb) {
    // API を実装した Lambda 関数を作成する
    const visualizationDashboardApiFunction = new lambdaPython.PythonFunction(this, 'VisualizationDashboardApiFunction', {
      entry: path.resolve(__dirname, '../../../backend/lambda/functions/ApiGateway/VisualizationDashboardApi'),
      runtime: lambda.Runtime.PYTHON_3_9,
      architecture: lambda.Architecture.X86_64,

      // memorySize: 1024,
      // ephemeralStorageSize: cdk.Size.gibibytes(1),

      environment: {
        QUICKSIGHT_IDENTITY_REGION: quickSightIdentityRegion,
        QUICKSIGHT_USER_NAMESPACE: quickSightUserNamespace,
        QUICKSIGHT_FEDERATION_ROLE_NAME: cognito.quickSightFederationRole!.roleName,
        DYNAMODB_TABLE_NAME_RUN_VISUALIZATIONS: dynamoDb.runVisualizationsTable.tableName,
        CORS_ALLOW_ORIGIN: this.allowOrigin,
      },

      layers: [this.layer],

      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE
    });
    visualizationDashboardApiFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'quicksight:GenerateEmbedUrlForRegisteredUser',
      ],
      resources: [
        cdk.Stack.of(this).formatArn({
          service: 'quicksight',
          region: quickSightIdentityRegion,
          resource: 'user',
          resourceName: `${quickSightUserNamespace}/${cognito.quickSightFederationRole!.roleName}/*`,
        }),
      ],
    }));
    dynamoDb.runVisualizationsTable.grantReadData(visualizationDashboardApiFunction);

    // API Gateway にルートを登録する
    const run = this.restApi.root.getResource('runs')!.getResource('{runId}')!;
    const visualizations = run.getResource('visualizations')!.getResource('{visualizationId}')!;
    const dashboard = visualizations.addResource('dashboard');
    dashboard.addMethod('GET', new apigw.LambdaIntegration(visualizationDashboardApiFunction));
  }
}
