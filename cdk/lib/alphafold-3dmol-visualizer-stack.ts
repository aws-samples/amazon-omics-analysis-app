import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as sfnTasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as glue from '@aws-cdk/aws-glue-alpha';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from 'aws-cdk-lib/aws-iam';

import * as path from 'path';
import * as fs from "fs";

import { DynamoDb } from "./constructs/backend-dynamodb";

/** {@link AlphaFold3DmolVisualizerStack} のパラメーター */
export interface AlphaFold3DmolVisualizerStackProps extends cdk.StackProps {
  /** 前処理や後処理の結果を保存するための DynamoDB テーブル */
  dynamoDb: DynamoDb;
}

/** AlphaFold の 3Dmol による可視化を構築する CDK スタック */
export class AlphaFold3DmolVisualizerStack extends cdk.Stack {
  /**
   * {@link AlphaFold3DmolVisualizerStack} をデプロイする
   * @param scope スタックのスコープ
   * @param id スタックの ID
   * @param props パラメーター
   */
  constructor(scope: Construct, id: string, props: AlphaFold3DmolVisualizerStackProps) {
    super(scope, id, props);

    const stageName = cdk.Stage.of(this)?.stageName;

    // Omics ワークフローの実行結果の出力先となる S3 バケットを取得
    const workflowOutputBucketArn = cdk.Fn.importValue(`${stageName ?? ''}OmicsWorkflowOutputBucketArn`);
    const workflowOutputBucket = s3.Bucket.fromBucketArn(this, 'WorkflowOutputBucket', workflowOutputBucketArn);

    // AlphaFold の実行結果を展開する Glue python shell ジョブを作成する
    const extractResultsJob = new glue.Job(this, 'ExtractResultsJob', {
      jobName: `${stageName ?? ''}AlphaFoldExtractResultsJob`,
      // Job で利用する実行環境とソースコードの場所の指定
      executable: glue.JobExecutable.pythonShell({
        glueVersion: glue.GlueVersion.V2_0,
        pythonVersion: glue.PythonVersion.THREE_NINE,
        script: glue.Code.fromAsset(path.join(__dirname, '../../visualizer/glue/AlphaFoldExtractResultsJob/index.py')),
      }),

      // ジョブが利用する各種リソースをコマンドライン引数として設定
      defaultArguments: {
        '--DYNAMODB_TABLE_NAME_RUN_VISUALIZATIONS': props.dynamoDb.runVisualizationsTable.tableName,
      },

      // Job の実行で利用する DPU (Data Processing Unit) の最大数
      maxCapacity: 1,
    });
    extractResultsJob.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess'));
    workflowOutputBucket.grantReadWrite(extractResultsJob);
    props.dynamoDb.runVisualizationsTable.grantReadWriteData(extractResultsJob);

    // AlphaFold の実行結果を展開するタスク
    const extractResultsTask = new sfnTasks.GlueStartJobRun(this, 'ExtractResultsTask', {
      comment: 'Visualize AlphaFold results.',
      glueJobName: extractResultsJob.jobName,
      integrationPattern: sfn.IntegrationPattern.RUN_JOB, // Job の実行終了まで待機する
      arguments: sfn.TaskInput.fromObject({
        '--analysis_id': sfn.JsonPath.stringAt('$.AnalysisId'),
        '--user_id': sfn.JsonPath.stringAt('$.UserId'),
        '--run_id': sfn.JsonPath.stringAt('$.OmicsRun.RunId'),
        '--output_uri': sfn.JsonPath.stringAt('$.OmicsRun.OutputUri'),
        '--visualizer_id': sfn.JsonPath.stringAt('$.Visualizer.VisualizerId'),
      }),
    });

    // ワークフローの前処理や後処理を実行する Step Functions ステートマシンの実行ロールを取得
    const workflowRunnerRoleArn = cdk.Fn.importValue(`${stageName ?? ''}OmicsWorkflowRunnerRoleArn`);
    const workflowRunnerRole = iam.Role.fromRoleArn(this, 'WorkflowRunnerRole', workflowRunnerRoleArn);

    // 可視化を実行するための Step Functions ステートマシンを作成する
    const stateMachine = new sfn.StateMachine(this, 'StateMachine', {
      stateMachineName: `${stageName ?? ''}AlphaFold3DmolVisualizer`,
      definition: extractResultsTask,
      tracingEnabled: true,
    });
    stateMachine.grantStartExecution(workflowRunnerRole);
    stateMachine.grantExecution(workflowRunnerRole, 'states:DescribeExecution', 'states:StopExecution');

    // ワークフローで実行可能な可視化を WorkflowVisualizers テーブルに登録するための CloudFormation カスタムリソースを実装した Lambda 関数を作成
    const registrationFunction = new lambda.SingletonFunction(this, 'RegistrationFunction', {
      uuid: 'fefb26e2-d19e-4153-b224-10c00000da1d',
      lambdaPurpose: 'VisualizerRegistrationFunction',
      code: lambda.Code.fromInline(fs.readFileSync(path.join(__dirname, '../../visualizer/lambda/VisualizerRegistration/index.py'), 'utf8')),
      handler: 'index.handler',

      runtime: lambda.Runtime.PYTHON_3_9,
      architecture: lambda.Architecture.X86_64,
      environment: {
        DYNAMODB_TABLE_NAME_WORKFLOW_VISUALIZERS: props.dynamoDb.workflowVisualizersTable.tableName,
      },

      timeout: cdk.Duration.seconds(900),
      tracing: lambda.Tracing.ACTIVE,
    });
    props.dynamoDb.workflowVisualizersTable.grantReadWriteData(registrationFunction);

    // AlphaFold の可視化として 3Dmol を登録する
    const visualizerUpTo600 = new cdk.CustomResource(this, 'VisualizerUpTo600', {
      serviceToken: registrationFunction.functionArn,
      resourceType: 'Custom::VisualizerRegistration',
      properties: {
        WorkflowType: 'READY2RUN',
        WorkflowId: '4885129',
        VisualizerId: '3Dmol',
        Name: '3Dmol visualization',
        StateMachineArn: stateMachine.stateMachineArn,
      },
    });
    const visualizerUpTo1200 = new cdk.CustomResource(this, 'VisualizerUpTo1200', {
      serviceToken: registrationFunction.functionArn,
      resourceType: 'Custom::VisualizerRegistration',
      properties: {
        WorkflowType: 'READY2RUN',
        WorkflowId: '6094971',
        VisualizerId: '3Dmol',
        Name: '3Dmol visualization',
        StateMachineArn: stateMachine.stateMachineArn,
      },
    });
  }
}
