import os
import json
import botocore
import boto3
import api_common

from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext

# DynamoDB のテーブル名を環境変数から取得
DYNAMODB_TABLE_NAME_RUN_VISUALIZATIONS = os.environ['DYNAMODB_TABLE_NAME_RUN_VISUALIZATIONS']

# ログとトレースの機能を初期化
logger = Logger()
tracer = Tracer()

# AWS サービスのクライアントを初期化
dynamodb = boto3.client('dynamodb')


# ワークフローで実行された可視化を扱う API を実装した Lambda 関数のハンドラ
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
        visualizationId = pathParams.get('visualizationId')
        if not visualizationId:
            # パスに可視化 ID が含まれていなかったら、可視化の一覧を返す
            return handle_list_run_visualizations(runId, queryParams)
        else:
            # 可視化 ID が含まれていたら、特定の可視化の詳細情報を返す
            return handle_get_run_visualization(runId, visualizationId, queryParams)

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


# 可視化の一覧を返す
def handle_list_run_visualizations(runId: str, queryParams: dict) -> dict:
    maxResults = queryParams.get('maxResults')
    startingToken = queryParams.get('startingToken')

    # DynamoDB の RunVisualizations テーブルから、指定された runId の可視化の一覧を取得する
    response = dynamodb.query(
        TableName=DYNAMODB_TABLE_NAME_RUN_VISUALIZATIONS,
        KeyConditionExpression='runId = :runId',
        ExpressionAttributeValues=api_common.dict_to_dynamodb({
            ':runId': runId,
        }),
        **({'Limit': maxResults} if maxResults else {}),
        **({'ExclusiveStartKey': json.loads(startingToken)} if startingToken else {}),
    )

    items = response.get('Items')
    lastEvaluatedKey = response.get('LastEvaluatedKey')

    # DynamoDB から取得した情報を JSON 化して返す
    responseBody = {
        'items': [api_common.dict_from_dynamodb(item) for item in items] if items else [],
        **({'nextToken': json.dumps(lastEvaluatedKey, default=api_common.default_serializer)} if lastEvaluatedKey else {}),
    }

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            **api_common.CORS_HEADERS,
        },
        'body': json.dumps(responseBody, default=api_common.default_serializer),
    }


# 特定の可視化の詳細情報を返す
def handle_get_run_visualization(runId: str, visualizationId: str, queryParams: dict) -> dict:
    # DynamoDB の RunVisualizations テーブルから可視化の詳細情報を取得する
    response = dynamodb.get_item(
        TableName=DYNAMODB_TABLE_NAME_RUN_VISUALIZATIONS,
        Key=api_common.dict_to_dynamodb({
            'runId': runId,
            'visualizationId': visualizationId,
        }),
    )

    # DynamoDB から取得した情報を JSON 化して返す
    item = api_common.dict_from_dynamodb(response.get('Item'))
    if not item:
        return {
            'statusCode': 404,
            'headers': api_common.CORS_HEADERS,
        }

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            **api_common.CORS_HEADERS,
        },
        'body': json.dumps(item, default=api_common.default_serializer),
    }
