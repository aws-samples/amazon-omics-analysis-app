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


# ワークフローで実行されたタスクを扱う API を実装した Lambda 関数のハンドラ
# CloudWatch Logs と X-Ray によるログとトレースを有効化
@tracer.capture_lambda_handler
@logger.inject_lambda_context(log_event=True)
def handler(event: dict, context: LambdaContext) -> dict:
    # REST API に指定されたパスを取得
    pathParams = event.get('pathParameters')
    if not pathParams:
        # パス情報がなければ 400 Bad Request とする
        return {
            'statusCode': 400,
            'headers': api_common.CORS_HEADERS,
        }

    runId = pathParams.get('runId')
    if not runId:
        # パスに実行 ID が含まれていなければ 404 Not Found とする
        return {
            'statusCode': 404,
            'headers': api_common.CORS_HEADERS,
        }

    # REST API に指定されたクエリ文字列を取得
    queryParams = event.get('queryStringParameters') or {}

    try:
        taskId = pathParams.get('taskId')
        if not taskId:
            # パスにタスク ID が含まれていなかったら、タスクの一覧を返す
            return handle_list_run_tasks(runId, queryParams)
        else:
            # タスク ID が含まれていたら、特定のタスクの詳細情報を返す
            return handle_get_run_task(runId, taskId, queryParams)

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


# タスクの一覧を返す
def handle_list_run_tasks(runId: str, queryParams: dict) -> dict:
    maxResults = queryParams.get('maxResults')
    startingToken = queryParams.get('startingToken')
    status = queryParams.get('status')

    # Omics のワークフロー実行のタスク一覧を取得する
    response = omics.list_run_tasks(
        id=runId,
        **({'maxResults': int(maxResults)} if maxResults else {}),
        **({'startingToken': startingToken} if startingToken else {}),
        **({'status': status} if status else {}),
    )

    # タスク一覧を JSON 化して返す
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


# 特定のタスクの詳細情報を返す
def handle_get_run_task(runId: str, taskId: str, queryParams: dict) -> dict:
    # Omics のタスクの詳細情報を取得する
    response = omics.get_run_task(id=runId, taskId=taskId)

    # 情報を JSON 化して返す
    taskId = response.get('taskId')
    name = response.get('name')
    status = response.get('status')
    statusMessage = response.get('statusMessage')
    cpus = response.get('cpus')
    gpus = response.get('gpus')
    memory = response.get('memory')
    creationTime = response.get('creationTime')
    startTime = response.get('startTime')
    stopTime = response.get('stopTime')
    logStream = response.get('logStream')
    responseBody = {
        **({'taskId': taskId} if taskId else {}),
        **({'name': name} if name else {}),
        **({'status': status} if status else {}),
        **({'statusMessage': statusMessage} if statusMessage else {}),
        **({'cpus': cpus} if cpus is not None else {}),
        **({'gpus': gpus} if gpus is not None else {}),
        **({'memory': memory} if memory is not None else {}),
        **({'creationTime': creationTime} if creationTime else {}),
        **({'startTime': startTime} if startTime else {}),
        **({'stopTime': stopTime} if stopTime else {}),
        **({'logStream': logStream} if logStream else {}),
    }

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            **api_common.CORS_HEADERS,
        },
        'body': json.dumps(responseBody, default=api_common.default_serializer),
    }
