import boto3

from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext

# ログとトレースの機能を初期化
logger = Logger()
tracer = Tracer()

# AWS サービスのクライアントを初期化
omics = boto3.client('omics')


# Omics ワークフローを実行する Step Functions タスクを実装した Lambda 関数のハンドラ
# CloudWatch Logs と X-Ray によるログとトレースを有効化
@tracer.capture_lambda_handler
@logger.inject_lambda_context(log_event=True)
def handler(event: dict, context: LambdaContext) -> dict:
    analysisId = event['AnalysisId']

    # Step Functions ステートマシンから渡されたパラメーターからワークフローの実行パラメーターを取得する
    runParams = event['Parameters']
    workflowType = runParams['WorkflowType']
    workflowId = runParams['WorkflowId']
    roleArn = runParams['RoleArn']
    outputUri = runParams['OutputUri']
    parameters = runParams['Parameters']
    name = runParams.get('Name')
    priority = runParams.get('Priority')
    storageCapacity = runParams.get('StorageCapacity')
    requestId = runParams.get('RequestId')
    runGroupId = runParams.get('RunGroupId')
    logLevel = runParams.get('LogLevel')
    tags = runParams.get('Tags')

    # ワークフローを実行する
    response = omics.start_run(
        workflowType=workflowType,
        workflowId=workflowId,
        roleArn=roleArn,
        outputUri=outputUri,
        parameters=parameters,
        **({'name': name} if name else {}),
        **({'priority': priority} if priority is not None else {}),
        **({'storageCapacity': storageCapacity} if storageCapacity is not None else {}),
        **({'requestId': requestId} if requestId else {}),
        **({'runGroupId': runGroupId} if runGroupId else {}),
        **({'logLevel': logLevel} if logLevel else {}),
        **({'tags': tags} if tags else {}),
    )

    runId = response['id']
    status = response['status']

    # status に応じて「エラー」および「完了」のフラグを設定し、ワークフロー実行の状態データと共に返す
    isError = status in ['DELETED', 'CANCELLED', 'FAILED']
    isFinished = status in ['COMPLETED'] or isError

    return {
        'AnalysisId': analysisId,
        'RunId': runId,
        'RoleArn': roleArn,
        'Status': status,
        'StatusMessage': None,
        'IsFinished': isFinished,
        'IsError': isError,
    }
