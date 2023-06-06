import json
import botocore
import boto3
import api_common

from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext

# ログとトレースの機能を初期化
logger = Logger()
tracer = Tracer()

# AWS サービスのクライアントを初期化
omics = boto3.client('omics')


# ワークフローの実行状態を扱う API を実装した Lambda 関数のハンドラ
# CloudWatch Logs と X-Ray によるログとトレースを有効化
@tracer.capture_lambda_handler
@logger.inject_lambda_context(log_event=True)
def handler(event: dict, context: LambdaContext) -> dict:
    # REST API に指定されたパスとクエリ文字列を取得
    pathParams = event.get('pathParameters') or {}
    queryParams = event.get('queryStringParameters') or {}

    try:
        runId = pathParams.get('runId')
        if not runId:
            # パスに実行 ID が含まれていなかったら、ワークフロー実行の一覧を返す
            return handle_list_runs(queryParams)
        else:
            # 実行 ID が含まれていたら、特定の実行の詳細情報を返す
            return handle_get_run(runId, queryParams)

    except botocore.exceptions.ClientError as err:
        statusCode = err.response['ResponseMetadata']['HTTPStatusCode']
        code = err.response['Error']['Code']
        message = err.response['Error']['Message']
        logger.exception(f'{code}: {message}')

        # AWS の API からエラーレスポンスが返されたら、その内容に準じたエラーコードとメッセージを返す
        return {
            'statusCode': statusCode,
            'headers': {
                'Content-Type': 'application/json',
                **api_common.CORS_HEADERS,
            },
            'body': json.dumps({
                'code': code,
                'message': message,
            }, default=api_common.default_serializer),
        }

    except (botocore.exceptions.BotoCoreError, ValueError) as err:
        code = type(err).__name__
        message = str(err)
        logger.exception(f'{code}: {message}')

        # その他のエラーが発生したら、エラーメッセージと共に 400 Bad Request を返す
        return {
            'statusCode': 400,
            'headers': {
                'Content-Type': 'application/json',
                **api_common.CORS_HEADERS,
            },
            'body': json.dumps({
                'code': code,
                'message': message,
            }, default=api_common.default_serializer),
        }


# ワークフロー実行の一覧を返す
def handle_list_runs(queryParams: dict) -> dict:
    maxResults = queryParams.get('maxResults')
    name = queryParams.get('name')
    runGroupId = queryParams.get('runGroupId')
    startingToken = queryParams.get('startingToken')

    # Omics のワークフロー実行の一覧を取得する
    response = omics.list_runs(
        **({'maxResults': int(maxResults)} if maxResults else {}),
        **({'name': name} if name else {}),
        **({'runGroupId': runGroupId} if runGroupId else {}),
        **({'startingToken': startingToken} if startingToken else {}),
    )

    # ワークフロー実行の一覧を JSON 化して返す
    items = response.get('items')
    nextToken = response.get('nextToken')
    responseBody = {
        'items': items or [],
        **({'nextToken': nextToken} if nextToken else {}),
    }

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            **api_common.CORS_HEADERS,
        },
        'body': json.dumps(responseBody, default=api_common.default_serializer),
    }


# 特定のワークフロー実行の詳細情報を返す
def handle_get_run(runId: str, queryParams: dict) -> dict:
    # Omics のワークフロー実行の詳細情報を取得する
    response = omics.get_run(id=runId)

    # 情報を JSON 化して返す
    id = response.get('id')
    arn = response.get('arn')
    name = response.get('name')
    status = response.get('status')
    statusMessage = response.get('statusMessage')
    runId = response.get('runId')
    runGroupId = response.get('runGroupId')
    workflowType = response.get('workflowType')
    workflowId = response.get('workflowId')
    parameters = response.get('parameters')
    outputUri = response.get('outputUri')
    priority = response.get('priority')
    storageCapacity = response.get('storageCapacity')
    accelerators = response.get('accelerators')
    startedBy = response.get('startedBy')
    roleArn = response.get('roleArn')
    definition = response.get('definition')
    digest = response.get('digest')
    resourceDigests = response.get('resourceDigests')
    logLevel = response.get('logLevel')
    tags = response.get('tags')
    creationTime = response.get('creationTime')
    startTime = response.get('startTime')
    stopTime = response.get('stopTime')
    responseBody = {
        **({'id': id} if id else {}),
        **({'arn': arn} if arn else {}),
        **({'name': name} if name else {}),
        **({'status': status} if status else {}),
        **({'statusMessage': statusMessage} if statusMessage else {}),
        **({'runId': runId} if runId else {}),
        **({'runGroupId': runGroupId} if runGroupId else {}),
        **({'workflowType': workflowType} if workflowType else {}),
        **({'workflowId': workflowId} if workflowId else {}),
        **({'parameters': parameters} if parameters else {}),
        **({'outputUri': outputUri} if outputUri else {}),
        **({'priority': priority} if priority is not None else {}),
        **({'storageCapacity': storageCapacity} if storageCapacity is not None else {}),
        **({'accelerators': accelerators} if accelerators else {}),
        **({'startedBy': startedBy} if startedBy else {}),
        **({'roleArn': roleArn} if roleArn else {}),
        **({'definition': definition} if definition else {}),
        **({'digest': digest} if digest else {}),
        **({'resourceDigests': resourceDigests} if resourceDigests else {}),
        **({'logLevel': logLevel} if logLevel else {}),
        **({'tags': tags} if tags else {}),
        **({'creationTime': creationTime} if creationTime else {}),
        **({'startTime': startTime} if startTime else {}),
        **({'stopTime': stopTime} if stopTime else {}),
    }

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            **api_common.CORS_HEADERS,
        },
        'body': json.dumps(responseBody, default=api_common.default_serializer),
    }
