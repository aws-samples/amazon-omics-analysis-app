import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as sfnTasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaPython from '@aws-cdk/aws-lambda-python-alpha';
import * as iam from 'aws-cdk-lib/aws-iam';

import * as path from 'path';

/** {@link WorkflowRunner} コンストラクトのパラメーター */
export interface WorkflowRunnerProps {
  /** Lambda 関数が共通で利用する Lambda レイヤー */
  commonLayer: lambda.ILayerVersion;
}

/**
 * API Gateway を構築する CDK コンストラクト
 */
export class WorkflowRunner extends Construct {
  /** ワークフローの前処理や後処理を実行する Step Functions ステートマシン */
  readonly stateMachine: sfn.StateMachine;

  /**
   * {@link WorkflowRunner} コンストラクトを作成する
   * @param scope コンストラクトのスコープ
   * @param id コンストラクトの ID
   * @param props パラメーター
   */
  constructor(scope: Construct, id: string, props: WorkflowRunnerProps) {
    super(scope, id);

    // Omics のワークフローを実行する Step Functions タスクを実装した Lambda 関数を作成する
    const omicsStartRunTaskFunction = new lambdaPython.PythonFunction(this, 'OmicsStartRunTaskFunction', {
      entry: path.resolve(__dirname, '../../../backend/lambda/functions/StepFunctions/StartRunTask'),
      runtime: lambda.Runtime.PYTHON_3_9,
      architecture: lambda.Architecture.X86_64,

      // memorySize: 1024,
      // ephemeralStorageSize: cdk.Size.gibibytes(1),

      environment: {
      },

      layers: [props.commonLayer],

      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE
    });

    // Omics のワークフローを実行する権限を `OmicsStartRunTaskFunction` 関数に追加
    const omicsStartRunPolicy = new iam.Policy(this, 'OmicsStartRunPolicy', {
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'omics:StartRun',
          ],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'iam:PassRole',
          ],
          resources: ['*'],
          conditions: {
            'StringEquals': {
              'iam:PassedToService': 'omics.amazonaws.com',
            },
          },
        }),
      ],
    });
    omicsStartRunTaskFunction.role?.attachInlinePolicy(omicsStartRunPolicy);

    // Omics のリソースにタグ付けする権限を `OmicsStartRunTaskFunction` 関数に追加
    const tagOmicsResourcesPolicy = new iam.Policy(this, 'TagOmicsResourcesPolicy', {
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'omics:TagResource',
          ],
          resources: ['*'],
        }),
      ],
    });
    omicsStartRunTaskFunction.role?.attachInlinePolicy(tagOmicsResourcesPolicy);

    // Omics ワークフローの実行状況を取得する Step Functions タスクを実装した Lambda 関数を作成する
    const omicsGetRunStatusTaskFunction = new lambdaPython.PythonFunction(this, 'OmicsGetRunStatusTaskFunction', {
      entry: path.resolve(__dirname, '../../../backend/lambda/functions/StepFunctions/GetRunStatusTask'),
      runtime: lambda.Runtime.PYTHON_3_9,
      architecture: lambda.Architecture.X86_64,

      // memorySize: 1024,
      // ephemeralStorageSize: cdk.Size.gibibytes(1),

      environment: {
      },

      layers: [props.commonLayer],

      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE
    });

    // Omics ワークフローの情報を取得する権限を `OmicsGetRunStatusTaskFunction` 関数に追加
    const omicsGetRunPolicy = new iam.Policy(this, 'OmicsGetRunPolicy', {
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'omics:GetRun',
          ],
          resources: ['*'],
        }),
      ],
    });
    omicsGetRunStatusTaskFunction.role?.attachInlinePolicy(omicsGetRunPolicy);

    // ワークフロー完了時のメール通知を行う Step Functions タスクを実装した Lambda 関数を作成する
    const notificationTaskFunction = new lambdaPython.PythonFunction(this, 'NotificationTaskFunction', {
      entry: path.resolve(__dirname, '../../../backend/lambda/functions/StepFunctions/NotificationTask'),
      runtime: lambda.Runtime.PYTHON_3_9,
      architecture: lambda.Architecture.X86_64,

      // memorySize: 1024,
      // ephemeralStorageSize: cdk.Size.gibibytes(1),

      environment: {
      },

      layers: [props.commonLayer],

      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE
    });

    // SES でメールを送信する権限を `NotificationTaskFunction` 関数に追加
    const sendEmailPolicy = new iam.Policy(this, 'SendEmailPolicy', {
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'ses:SendEmail',
            'ses:SendRawEmail',
          ],
          resources: ['*'],
        }),
      ],
    });
    notificationTaskFunction.role?.attachInlinePolicy(sendEmailPolicy);

    // 以下、Step Functions ステートマシンの定義

    // 'OmicsStartRun' がステートマシンの入力にあるかどうかをチェックするタスク
    const checkOmicsStartRunTask = new sfn.Choice(this, 'CheckOmicsStartRunTask', {
      comment: "Is 'OmicsStartRun' present in the input?",
    });

    // 'OmicsRun' がステートマシンの入力にあるかどうかをチェックするタスク
    const checkOmicsRunTask = new sfn.Choice(this, 'CheckOmicsRunTask', {
      comment: "Is 'OmicsRun' present in the input?",
    });

    // Omics のワークフロー実行の詳細情報を取得するタスク
    const omicsGetRunTask = new sfnTasks.LambdaInvoke(this, 'OmicsGetRunTask', {
      comment: "Get Omics workflow run details as 'OmicsRun'.",
      lambdaFunction: omicsGetRunStatusTaskFunction,
      payload: sfn.TaskInput.fromObject({
        AnalysisId: sfn.JsonPath.stringAt('$$.Execution.Id'),
        OmicsRun: sfn.JsonPath.objectAt('$.OmicsRun'),
      }),
      resultSelector: {
        RunId: sfn.JsonPath.stringAt('$.Payload.RunId'),
        RoleArn: sfn.JsonPath.stringAt('$.Payload.RoleArn'),
        Status: sfn.JsonPath.stringAt('$.Payload.Status'),
        StatusMessage: sfn.JsonPath.stringAt('$.Payload.StatusMessage'),
        IsFinished: sfn.JsonPath.stringAt('$.Payload.IsFinished'),
        IsError: sfn.JsonPath.stringAt('$.Payload.IsError'),
        WorkflowType: sfn.JsonPath.stringAt('$.Payload.WorkflowType'),
        WorkflowId: sfn.JsonPath.stringAt('$.Payload.WorkflowId'),
        OutputUri: sfn.JsonPath.stringAt('$.Payload.OutputUri'),
        Parameters: sfn.JsonPath.objectAt('$.Payload.Parameters'),
        Name: sfn.JsonPath.stringAt('$.Payload.Name'),
        Priority: sfn.JsonPath.stringAt('$.Payload.Priority'),
        StorageCapacity: sfn.JsonPath.stringAt('$.Payload.StorageCapacity'),
        Accelerators: sfn.JsonPath.stringAt('$.Payload.Accelerators'),
        RunGroupId: sfn.JsonPath.stringAt('$.Payload.RunGroupId'),
        LogLevel: sfn.JsonPath.stringAt('$.Payload.LogLevel'),
        Tags: sfn.JsonPath.objectAt('$.Payload.Tags'),
        StartedBy: sfn.JsonPath.stringAt('$.Payload.StartedBy'),
        CreationTime: sfn.JsonPath.stringAt('$.Payload.CreationTime'),
        StartTime: sfn.JsonPath.stringAt('$.Payload.StartTime'),
        StopTime: sfn.JsonPath.stringAt('$.Payload.StopTime'),
      },
      resultPath: '$.OmicsRun',
    });

    // Omics のワークフローを実行するタスク
    const omicsStartRunTask = new sfnTasks.LambdaInvoke(this, 'OmicsStartRunTask', {
      comment: 'Start Omics workflow run.',
      lambdaFunction: omicsStartRunTaskFunction,
      payload: sfn.TaskInput.fromObject({
        AnalysisId: sfn.JsonPath.stringAt('$$.Execution.Id'),
        UserId: sfn.JsonPath.stringAt('$.UserId'),
        Parameters: sfn.JsonPath.objectAt('$.OmicsStartRun'),
      }),
      resultSelector: {
        RunId: sfn.JsonPath.stringAt('$.Payload.RunId'),
        RoleArn: sfn.JsonPath.stringAt('$.Payload.RoleArn'),
        Status: sfn.JsonPath.stringAt('$.Payload.Status'),
        StatusMessage: sfn.JsonPath.stringAt('$.Payload.StatusMessage'),
        IsFinished: sfn.JsonPath.stringAt('$.Payload.IsFinished'),
        IsError: sfn.JsonPath.stringAt('$.Payload.IsError'),
      },
      resultPath: '$.OmicsRun',
    });

    // Omics ワークフローの実行完了を一定時間待つタスク
    const waitAfterOmicsStartRunTask = new sfn.Wait(this, 'WaitAfterOmicsStartRunTask', {
      comment: 'Wait for a few minutes for Omics workflow run to complete.',
      time: sfn.WaitTime.duration(cdk.Duration.seconds(60)),
    });

    // Omics のワークフロー実行状態を取得するタスク
    const omicsGetRunStatusTask = new sfnTasks.LambdaInvoke(this, 'OmicsGetRunStatusTask', {
      comment: "Get Omics run status as 'OmicsRun'.",
      lambdaFunction: omicsGetRunStatusTaskFunction,
      payload: sfn.TaskInput.fromObject({
        AnalysisId: sfn.JsonPath.stringAt('$$.Execution.Id'),
        OmicsRun: sfn.JsonPath.objectAt('$.OmicsRun'),
      }),
      resultSelector: {
        RunId: sfn.JsonPath.stringAt('$.Payload.RunId'),
        RoleArn: sfn.JsonPath.stringAt('$.Payload.RoleArn'),
        Status: sfn.JsonPath.stringAt('$.Payload.Status'),
        StatusMessage: sfn.JsonPath.stringAt('$.Payload.StatusMessage'),
        IsFinished: sfn.JsonPath.stringAt('$.Payload.IsFinished'),
        IsError: sfn.JsonPath.stringAt('$.Payload.IsError'),
        WorkflowType: sfn.JsonPath.stringAt('$.Payload.WorkflowType'),
        WorkflowId: sfn.JsonPath.stringAt('$.Payload.WorkflowId'),
        OutputUri: sfn.JsonPath.stringAt('$.Payload.OutputUri'),
        Parameters: sfn.JsonPath.objectAt('$.Payload.Parameters'),
        Name: sfn.JsonPath.stringAt('$.Payload.Name'),
        Priority: sfn.JsonPath.stringAt('$.Payload.Priority'),
        StorageCapacity: sfn.JsonPath.stringAt('$.Payload.StorageCapacity'),
        Accelerators: sfn.JsonPath.stringAt('$.Payload.Accelerators'),
        RunGroupId: sfn.JsonPath.stringAt('$.Payload.RunGroupId'),
        LogLevel: sfn.JsonPath.stringAt('$.Payload.LogLevel'),
        Tags: sfn.JsonPath.objectAt('$.Payload.Tags'),
        StartedBy: sfn.JsonPath.stringAt('$.Payload.StartedBy'),
        CreationTime: sfn.JsonPath.stringAt('$.Payload.CreationTime'),
        StartTime: sfn.JsonPath.stringAt('$.Payload.StartTime'),
        StopTime: sfn.JsonPath.stringAt('$.Payload.StopTime'),
      },
      resultPath: '$.OmicsRun',
    });

    // Omics のワークフロー実行が完了したかどうかをチェックするタスク
    const checkOmicsRunFinishedTask = new sfn.Choice(this, 'CheckOmicsRunFinishedTask', {
      comment: 'Is Omics workflow run finished?',
    });

    // Omics のワークフロー実行が失敗したかどうかをチェックするタスク
    const checkOmicsRunFailedTask = new sfn.Choice(this, 'CheckOmicsRunFailedTask', {
      comment: 'Is Omics workflow run failed?',
    });

    // 'Visualization' がステートマシンの入力にあるかどうかをチェックするタスク
    const checkVisualizationTask = new sfn.Choice(this, 'CheckVisualizationTask', {
      comment: "Is 'Visualization' present in the input?",
    });

    // 可視化を実行する子ステートマシンを実行するタスク
    const visualizationTask = new StepFunctionsDynamicStateMachineExecutionTask(this, 'VisualizationTask', {
      comment: 'Start visualization of workflow run outputs with nested Step Functions state machine.',
      stateMachineArn: sfn.JsonPath.stringAt('$.Visualization.StateMachineArn'),
      name: sfn.JsonPath.format('{}-visualization', sfn.JsonPath.stringAt('$$.Execution.Name')),
      input: sfn.TaskInput.fromObject({
        AnalysisId: sfn.JsonPath.stringAt('$$.Execution.Id'),
        UserId: sfn.JsonPath.stringAt('$.UserId'),
        OmicsRun: sfn.JsonPath.objectAt('$.OmicsRun'),
        Visualization: sfn.JsonPath.objectAt('$.Visualization'),
      }),
      resultPath: '$.VisualizationResult',
    });

    // 'Notification' がステートマシンの入力にあるかどうかをチェックするタスク
    const checkNotificationTask = new sfn.Choice(this, 'CheckNotificationTask', {
      comment: "Is 'Notification' present in the input?",
    });

    // ステートマシンの実行完了メールを送信するタスク
    const notificationTask = new sfnTasks.LambdaInvoke(this, 'NotificationTask', {
      comment: 'Notify completion of analysis.',
      lambdaFunction: notificationTaskFunction,
      payload: sfn.TaskInput.fromObject({
        AnalysisId: sfn.JsonPath.stringAt('$$.Execution.Id'),
        OmicsRun: sfn.JsonPath.objectAt('$.OmicsRun'),
        Notification: sfn.JsonPath.objectAt('$.Notification'),
      }),
      resultSelector: {
        Email: sfn.JsonPath.objectAt('$.Payload.Email'),
      },
      resultPath: '$.NotificationResult',
    });

    // Omics のワークフロー実行が失敗したかどうかをチェックするタスク
    const checkWorkflowRunnerFailedTask = new sfn.Choice(this, 'CheckWorkflowRunnerFailedTask', {
      comment: 'Is Omics workflow run failed?',
    });

    // ステートマシンの実行を成功とするタスク
    const omicsWorkflowRunnerSucceedTask = new sfn.Succeed(this, 'WorkflowRunnerSucceedTask', {
      comment: 'Analysis succeeded.',
    });

    // ステートマシンの実行を失敗とするタスク
    const omicsRunFailedTask = new sfn.Fail(this, 'OmicsRunFailedTask', {
      comment: 'Analysis failed.',
      error: '$.OmicsRun.Status',
      cause: '$.OmicsRun.StatusMessage',
    });

    const stageName = cdk.Stage.of(this)?.stageName;

    // ワークフローの前処理や後処理を実行する Step Functions ステートマシンを作成する
    this.stateMachine = new sfn.StateMachine(this, 'StateMachine', {
      stateMachineName: `${stageName ?? ''}OmicsWorkflowRunner`,
      definition: checkOmicsStartRunTask
        .when(sfn.Condition.isNotPresent('$.OmicsStartRun'),
          checkOmicsRunTask
          .when(sfn.Condition.isPresent('$.OmicsRun'),
            omicsGetRunTask
            .next(checkVisualizationTask)
          )
          .otherwise(omicsWorkflowRunnerSucceedTask)
        )
        .otherwise(
          omicsStartRunTask
          .next(waitAfterOmicsStartRunTask)
          .next(omicsGetRunStatusTask)
          .next(checkOmicsRunFinishedTask
            .when(sfn.Condition.booleanEquals('$.OmicsRun.IsFinished', false),
              waitAfterOmicsStartRunTask
            )
            .otherwise(
              checkOmicsRunFailedTask
              .when(sfn.Condition.booleanEquals('$.OmicsRun.IsError', false),
                checkVisualizationTask
                .when(sfn.Condition.isPresent('$.Visualization'),
                  visualizationTask
                )
                .afterwards({
                  includeOtherwise: true,
                })
                .next(checkNotificationTask)
              )
              .afterwards({
                includeOtherwise: true,
              })
              .next(checkNotificationTask
                .when(sfn.Condition.isPresent('$.Notification'),
                  notificationTask
                )
                .afterwards({
                  includeOtherwise: true,
                })
                .next(checkWorkflowRunnerFailedTask
                  .when(sfn.Condition.booleanEquals('$.OmicsRun.IsError', true),
                    omicsRunFailedTask
                  ).otherwise(
                    omicsWorkflowRunnerSucceedTask
                  )
                )
              )
            )
          )
        ),
      tracingEnabled: true, // AWS X-Ray によるトレースを有効化する
    });
  }
}

/** {@link StepFunctionsDynamicStateMachineExecutionTask} コンストラクトのパラメーター */
export interface StepFunctionsDynamicStateMachineExecutionTaskProps extends sfn.TaskStateBaseProps {
  /** ステートマシンの ARN */
  readonly stateMachineArn: string;

  /** ステートマシンの名前 */
  readonly name?: string;

  /** ステートマシンの入力パラメーター */
  readonly input?: sfn.TaskInput;
}

/** パラメーターで指定した任意の Step Functions ステートマシンを実行するための Step Functions タスク */
export class StepFunctionsDynamicStateMachineExecutionTask extends sfn.TaskStateBase {
  protected readonly taskMetrics?: sfn.TaskMetricsConfig;
  protected readonly taskPolicies?: iam.PolicyStatement[];

  /**
   * {@link StepFunctionsDynamicStateMachineExecutionTask} コンストラクトを作成する
   * @param scope コンストラクトのスコープ
   * @param id コンストラクトの ID
   * @param props パラメーター
   */
  constructor(scope: Construct, id: string, private readonly props: StepFunctionsDynamicStateMachineExecutionTaskProps) {
    super(scope, id, props);

    if (props.input && props.input.type !== sfn.InputType.OBJECT) {
      throw new Error('Could not enable `associateWithParent` because `input` is taken directly from a JSON path. Use `sfn.TaskInput.fromObject` instead.');
    }

    this.taskPolicies = [
      new iam.PolicyStatement({
        actions: ['events:PutTargets', 'events:PutRule', 'events:DescribeRule'],
        resources: [
          cdk.Stack.of(scope).formatArn({
            service: 'events',
            resource: 'rule',
            resourceName: 'StepFunctionsGetEventsForStepFunctionsExecutionRule',
          }),
        ],
      }),
    ];
  }

  protected _renderTask(): any {
    return {
      Resource: `arn:${cdk.Aws.PARTITION}:states:::states:startExecution.sync:2`,
      Parameters: sfn.FieldUtils.renderObject({
        Input: {
          AWS_STEP_FUNCTIONS_STARTED_BY_EXECUTION_ID: sfn.JsonPath.stringAt('$$.Execution.Id'),
          ...this.props.input && this.props.input.value,
        },
        StateMachineArn: this.props.stateMachineArn,
        Name: this.props.name,
      }),
    };
  }
}
