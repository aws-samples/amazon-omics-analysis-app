import boto3

from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext

# ログとトレースの機能を初期化
logger = Logger()
tracer = Tracer()

# AWS サービスのクライアントを初期化
omics = boto3.client('omics')


# Omics ワークフローの実行状態を取得する Step Functions タスクを実装した Lambda 関数のハンドラ
# CloudWatch Logs と X-Ray によるログとトレースを有効化
@tracer.capture_lambda_handler
@logger.inject_lambda_context(log_event=True)
def handler(event: dict, context: LambdaContext) -> dict:
    analysisId = event['AnalysisId']
    omicsRun = event['OmicsRun']

    # Step Functions ステートマシンから渡されたパラメーターから runId と status を取得する
    runId = omicsRun['RunId']

    # ワークフローの実行状態を取得する
    response = omics.get_run(id=runId)

    runId = response['id']
    status = response['status']
    statusMessage = response.get('statusMessage')
    name = response.get('name')
    runGroupId = response.get('runGroupId')
    workflowType = response.get('workflowType')
    workflowId = response.get('workflowId')
    parameters = response.get('parameters') or {}
    outputUri = response.get('outputUri')
    priority = response.get('priority')
    storageCapacity = response.get('storageCapacity')
    accelerators = response.get('accelerators')
    roleArn = response.get('roleArn')
    logLevel = response.get('logLevel')
    tags = response.get('tags')
    startedBy = response.get('startedBy')
    creationTime = response.get('creationTime')
    startTime = response.get('startTime')
    stopTime = response.get('stopTime')

    # status に応じて「エラー」および「完了」のフラグを設定し、ワークフロー実行の状態データと共に返す
    isError = status in ['DELETED', 'CANCELLED', 'FAILED']
    isFinished = status in ['COMPLETED'] or isError

    return {
        'AnalysisId': analysisId,
        'RunId': runId,
        'RoleArn': roleArn,
        'Status': status,
        'StatusMessage': statusMessage,
        'IsFinished': isFinished,
        'IsError': isError,
        'WorkflowType': workflowType,
        'WorkflowId': workflowId,
        'OutputUri': outputUri,
        'Parameters': parameters,
        'Name': name,
        'Priority': priority,
        'StorageCapacity': storageCapacity,
        'Accelerators': accelerators,
        'RunGroupId': runGroupId,
        'LogLevel': logLevel,
        'Tags': tags,
        'StartedBy': startedBy,
        'CreationTime': creationTime.isoformat() if creationTime is not None else None,
        'StartTime': startTime.isoformat() if startTime is not None else None,
        'StopTime': stopTime.isoformat() if stopTime is not None else None,
    }
