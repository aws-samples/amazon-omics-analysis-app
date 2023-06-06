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
logs = boto3.client('logs')


# タスクのログを扱う API を実装した Lambda 関数のハンドラ
# CloudWatch Logs と X-Ray によるログとトレースを有効化
@tracer.capture_lambda_handler
@logger.inject_lambda_context(log_event=True)
def handler(event: dict, context: LambdaContext) -> dict:
    pathParams = event.get('pathParameters')
    # REST API に指定されたパスを取得
    if not pathParams:
        # パス情報がなければ 400 Bad Request とする
        return {
            'statusCode': 400,
            'headers': api_common.CORS_HEADERS,
        }

    runId = pathParams.get('runId')
    taskId = pathParams.get('taskId')
    if not runId or not taskId:
        # パスに実行 ID とタスク ID が含まれていなければ 404 Not Found とする
        return {
            'statusCode': 404,
            'headers': api_common.CORS_HEADERS,
        }

    # REST API に指定されたクエリ文字列を取得
    queryParams = event.get('queryStringParameters') or {}

    try:
        # タスクの実行ログを返す
        return handle_get_run_task_log(runId, taskId, queryParams)

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


# タスクの実行ログを返す
def handle_get_run_task_log(runId: str, taskId: str, queryParams: dict) -> dict:
    # Omics のタスク情報を取得する
    getRunTaskResponse = omics.get_run_task(id=runId, taskId=taskId)

    # タスク情報に含まれる CloudWatch Logs ログストリームの ARN を取得し、ARN をロググループの ARN とログストリームの名前に分割する
    logStreamArn = getRunTaskResponse.get('logStream')
    logStreamLabel = ':log-stream:'
    logStreamIndex = logStreamArn.rfind(logStreamLabel)
    if logStreamIndex == -1:
        raise Exception('Unexpected log stream ARN')

    logGroupArn = logStreamArn[:logStreamIndex]
    logStreamName = logStreamArn[logStreamIndex + len(logStreamLabel):]
    startTime = queryParams.get('startTime')
    endTime = queryParams.get('endTime')
    nextToken = queryParams.get('nextToken')
    limit = queryParams.get('limit')
    startFromHead = queryParams.get('startFromHead')
    unmask = queryParams.get('unmask')

    # CloudWatch Logs からログを取得する
    getLogEventsResponse = logs.get_log_events(
        logGroupIdentifier=logGroupArn,
        logStreamName=logStreamName,
        **({'startTime': int(startTime)} if startTime else {}),
        **({'endTime': int(endTime)} if endTime else {}),
        **({'nextToken': nextToken} if nextToken else {}),
        **({'limit': int(limit)} if limit else {}),
        **({'startFromHead': api_common.string_to_bool(startFromHead)} if startFromHead else {}),
        **({'unmask': api_common.string_to_bool(unmask)} if unmask else {}),
    )

    # ログを JSON 化して返す
    events = getLogEventsResponse.get('events')
    nextForwardToken = getLogEventsResponse.get('nextForwardToken')
    nextBackwardToken = getLogEventsResponse.get('nextBackwardToken')
    responseBody = {
        'events': events or [],
        **({'nextForwardToken': nextForwardToken} if nextForwardToken else {}),
        **({'nextBackwardToken': nextBackwardToken} if nextBackwardToken else {}),
    }

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            **api_common.CORS_HEADERS,
        },
        'body': json.dumps(responseBody, default=api_common.default_serializer),
    }
