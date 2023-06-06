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


# ワークフローを扱う API を実装した Lambda 関数のハンドラ
# CloudWatch Logs と X-Ray によるログとトレースを有効化
@tracer.capture_lambda_handler
@logger.inject_lambda_context(log_event=True)
def handler(event: dict, context: LambdaContext) -> dict:
    # REST API に指定されたパスとクエリ文字列を取得
    pathParams = event.get('pathParameters')
    if not pathParams:
        # パス情報がなければ 400 Bad Request とする
        return {
            'statusCode': 400,
            'headers': api_common.CORS_HEADERS,
        }

    workflowType = pathParams.get('workflowType')
    if not workflowType:
        # パスにワークフロータイプが含まれていなければ 404 Not Found とする
        return {
            'statusCode': 404,
            'headers': api_common.CORS_HEADERS,
        }

    queryParams = event.get('queryStringParameters') or {}

    try:
        workflowId = pathParams.get('workflowId')
        if not workflowId:
            # パスにワークフロー ID が含まれていなかったら、ワークフローの一覧を返す
            return handle_list_workflows(workflowType, queryParams)
        else:
            # ワークフロー ID が含まれていたら、特定のワークフローの詳細情報を返す
            return handle_get_workflow(workflowType, workflowId, queryParams)

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


# ワークフローの一覧を返す
def handle_list_workflows(workflowType: str, queryParams: dict) -> dict:
    maxResults = queryParams.get('maxResults')
    name = queryParams.get('name')
    startingToken = queryParams.get('startingToken')

    # Omics ワークフローの一覧を取得する
    response = omics.list_workflows(
        type=workflowType,
        **({'maxResults': int(maxResults)} if maxResults else {}),
        **({'name': name} if name else {}),
        **({'startingToken': startingToken} if startingToken else {}),
    )

    # ワークフロー一覧を JSON 化して返す
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


# 特定のワークフローの詳細情報を返す
def handle_get_workflow(workflowType: str, workflowId: str, queryParams: dict) -> dict:
    # Omics ワークフローの詳細情報を取得する
    response = omics.get_workflow(
        type=workflowType,
        id=workflowId,
    )

    # ワークフロー情報を JSON 化して返す
    id = response.get('id')
    arn = response.get('arn')
    name = response.get('name')
    description = response.get('description')
    status = response.get('status')
    statusMessage = response.get('statusMessage')
    type = response.get('type')
    engine = response.get('engine')
    definition = response.get('definition')
    main = response.get('main')
    parameterTemplate = response.get('parameterTemplate')
    storageCapacity = response.get('storageCapacity')
    accelerators = response.get('accelerators')
    digest = response.get('digest')
    tags = response.get('tags')
    metadata = response.get('metadata')
    creationTime = response.get('creationTime')
    responseBody = {
        **({'id': id} if id else {}),
        **({'arn': arn} if arn else {}),
        **({'name': name} if name else {}),
        **({'description': description} if description else {}),
        **({'status': status} if status else {}),
        **({'statusMessage': statusMessage} if statusMessage else {}),
        **({'type': type} if type else {}),
        **({'engine': engine} if engine else {}),
        **({'definition': definition} if definition else {}),
        **({'main': main} if main else {}),
        **({'parameterTemplate': parameterTemplate} if parameterTemplate else {}),
        **({'storageCapacity': storageCapacity} if storageCapacity is not None else {}),
        **({'accelerators': accelerators} if accelerators else {}),
        **({'digest': digest} if digest else {}),
        **({'tags': tags} if tags else {}),
        **({'metadata': metadata} if metadata else {}),
        **({'creationTime': creationTime} if creationTime else {}),
    }

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            **api_common.CORS_HEADERS,
        },
        'body': json.dumps(responseBody, default=api_common.default_serializer),
    }
