import os
import json
import botocore
import boto3
import api_common

from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext

# QuickSight のサインアップを行ったリージョンを環境変数から取得
QUICKSIGHT_IDENTITY_REGION = os.environ['QUICKSIGHT_IDENTITY_REGION']

QUICKSIGHT_FEDERATION_ROLE_NAME = os.environ['QUICKSIGHT_FEDERATION_ROLE_NAME']

# QuickSight ユーザーの名前空間を環境変数から取得
QUICKSIGHT_USER_NAMESPACE = os.environ['QUICKSIGHT_USER_NAMESPACE']

# DynamoDB テーブルの ARN を環境変数から取得
DYNAMODB_TABLE_NAME_RUN_VISUALIZATIONS = os.environ['DYNAMODB_TABLE_NAME_RUN_VISUALIZATIONS']

# ログとトレースの機能を初期化
logger = Logger()
tracer = Tracer()

# STS のクライアントを初期化
quicksight = boto3.client('quicksight')
dynamodb = boto3.client('dynamodb')


# ワークフローの出力を可視化するダッシュボードを扱う API を実装した Lambda 関数のハンドラ
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

    runId = pathParams.get('runId')
    visualizationId = pathParams.get('visualizationId')
    if not runId or not visualizationId:
        # パスに実行 ID と可視化 ID が含まれていなければ 404 Not Found とする
        return {
            'statusCode': 404,
            'headers': api_common.CORS_HEADERS,
        }

    headers = event['headers']

    try:
        accountId = event['requestContext']['accountId']
        userId = event['requestContext']['authorizer']['claims']['sub']
        userArn = f'arn:aws:quicksight:{QUICKSIGHT_IDENTITY_REGION}:{accountId}:user/{QUICKSIGHT_USER_NAMESPACE}/{QUICKSIGHT_FEDERATION_ROLE_NAME}/{userId}'

        # パスに出力ファイルのパスが含まれていなかったら、全ての出力ファイルの一覧を返す
        return handle_get_dashboard(accountId, userArn, runId, visualizationId, headers)

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


# ダッシュボードの埋め込み URL に関する処理を行う
def handle_get_dashboard(accountId: str, userArn: str, runId: str, visualizationId: str, headers: dict) -> dict:
    # DynamoDB の RunVisualizations テーブルからダッシュボードの ID を取得する
    response = dynamodb.get_item(
        TableName=DYNAMODB_TABLE_NAME_RUN_VISUALIZATIONS,
        Key=api_common.dict_to_dynamodb({
            'runId': runId,
            'visualizationId': visualizationId,
        }),
    )
    item = api_common.dict_from_dynamodb(response.get('Item'))

    type = item.get('type') if item else None
    dashboardId = item.get('dashboardId') if item else None
    if type != 'QuickSightDashboard' or not dashboardId:
        # ダッシュボード ID が記録されていなければ 404 Not Found とする
        return {
            'statusCode': 404,
            'headers': api_common.CORS_HEADERS,
        }

    # ユーザーに対応する QuickSight ユーザーの権限で、ダッシュボードを Web アプリに埋め込むための URL を取得して返す
    origin = headers['origin']
    response = quicksight.generate_embed_url_for_registered_user(
        AwsAccountId=accountId,
        UserArn=userArn,
        ExperienceConfiguration={
            'Dashboard': {
                'InitialDashboardId': dashboardId,
                'FeatureConfigurations': {
                    'StatePersistence': {
                        'Enabled': True,
                    },
                },
            },
        },
        AllowedDomains=[
            origin,
        ],
    )

    embedUrl = response['EmbedUrl']

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            **api_common.CORS_HEADERS,
        },
        'body': embedUrl,
    }
