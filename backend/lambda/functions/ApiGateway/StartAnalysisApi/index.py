import os
import json
import uuid
import botocore
import boto3
import api_common

from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext

OMICS_WORKFLOW_RUN_ROLE_ARN = os.environ['OMICS_WORKFLOW_RUN_ROLE_ARN']

# ワークフローの出力先 S3 バケットのデフォルト値を環境変数から取得
OMICS_OUTPUT_BUCKET_URL = os.environ['OMICS_OUTPUT_BUCKET_URL']

# Step Functions ステートマシンの ARN を環境変数から取得
STEPFUNCTIONS_STATE_MACHINE_ARN = os.environ['STEPFUNCTIONS_STATE_MACHINE_ARN']

# DynamoDB のテーブル名を環境変数から取得
DYNAMODB_TABLE_NAME_WORKFLOW_VISUALIZERS = os.environ['DYNAMODB_TABLE_NAME_WORKFLOW_VISUALIZERS']

# AWS リージョンを環境変数から取得
AWS_REGION = os.environ['AWS_REGION']

# CDK のステージ名を環境変数から取得
STAGE_NAME = os.environ['STAGE_NAME']

# ログとトレースの機能を初期化
logger = Logger()
tracer = Tracer()

# AWS サービスのクライアントを初期化
omics = boto3.client('omics')
sfn = boto3.client('stepfunctions')
dynamodb = boto3.client('dynamodb')


# ワークフローを実行する API を実装した Lambda 関数のハンドラ
# CloudWatch Logs と X-Ray によるログとトレースを有効化
@tracer.capture_lambda_handler
@logger.inject_lambda_context(log_event=True)
def handler(event: dict, context: LambdaContext) -> dict:
    # REST API に指定されたリクエストボディを取得
    body = event.get('body')
    if not body:
        return {
            'statusCode': 400,
            'headers': api_common.CORS_HEADERS,
        }

    # Cognito オーソライザーによってデコードされた JSON Web Token の Claim 情報から、ユーザーやグループの情報を取得する
    # https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
    # https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-the-id-token.html
    requestContext = event['requestContext']
    claims = requestContext['authorizer']['claims']
    userId = claims['sub']
    email = claims['email']
    accountId = requestContext['accountId']

    headers = event['headers']
    requestBody = json.loads(body)

    try:
        return handle_start_analysis(userId, email, accountId, OMICS_WORKFLOW_RUN_ROLE_ARN, headers, requestBody)

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


# Step Functions ステートマシンを実行する
def handle_start_analysis(userId: str, email: str, accountId: str, role: str, headers: dict, requestBody: dict) -> dict:
    workflowType = requestBody['workflowType']
    workflowId = requestBody['workflowId']

    # Omics のワークフロー情報を取得する
    response = omics.get_workflow(
        type=workflowType,
        id=workflowId,
    )
    workflowName = response.get('name')
    parameterTemplate = response.get('parameterTemplate') or {}

    # ワークフローの実行パラメーターのデフォルト値を設定
    comprehensiveParameterDefaults = {
        'ecr_registry': f'{accountId}.dkr.ecr.{AWS_REGION}.amazonaws.com/',
    }
    # パラメーターテンプレートに存在するパラメーターのみを残す
    parameterDefaults = {
        key: value
        for key, value in comprehensiveParameterDefaults.items() if key in parameterTemplate and value is not None
    }

    # ワークフロー実行完了メールの内容に反映するため、リクエストヘッダーから Origin と Accept-Language を取得
    origin = headers['origin']
    acceptLanguage = headers['accept-language']

    # リクエストボディから Omics ワークフローの実行パラメーターを取得する
    roleArn = requestBody.get('roleArn') or role
    outputUri = requestBody.get('outputUri') or f"{OMICS_OUTPUT_BUCKET_URL}/{userId}/"
    parameters = requestBody.get('parameters')
    name = requestBody.get('name')
    priority = requestBody.get('priority')
    storageCapacity = requestBody.get('storageCapacity')
    requestId = requestBody.get('requestId') or str(uuid.uuid4())
    runGroupId = requestBody.get('runGroupId')
    logLevel = requestBody.get('logLevel')
    tags = requestBody.get('tags')
    visualizerId = requestBody.get('visualizerId')
    visualizer = getVisualizer(dynamodb, workflowType, workflowId, visualizerId, roleArn) if visualizerId else {}

    # Step Functions ステートマシンを実行する
    response = sfn.start_execution(
        stateMachineArn=STEPFUNCTIONS_STATE_MACHINE_ARN,
        input=json.dumps({
            'UserId': userId,
            'OmicsStartRun': {
                'WorkflowType': workflowType,
                'WorkflowId': workflowId,
                'WorkflowName': workflowName,
                'RoleArn': roleArn,
                'OutputUri': outputUri.rstrip('/'),
                'Parameters': {
                    **parameterDefaults,
                    **(parameters or {}),
                },
                **({'Name': name} if name else {}),
                **({'Priority': priority} if priority is not None else {}),
                **({'StorageCapacity': storageCapacity} if storageCapacity is not None else {}),
                **({'RequestId': requestId} if requestId else {}),
                **({'RunGroupId': runGroupId} if runGroupId else {}),
                **({'LogLevel': logLevel} if logLevel else {}),
                **({'Tags': tags} if tags else {}),
            },
            **({'Visualizer': visualizer} if visualizer else {}),
            'Notification': {
                'Email': email,
                'FrontendOrigin': origin,
                'AcceptLanguage': acceptLanguage,
            },
        })
    )
    executionArn = response['executionArn']

    # 実行の情報を JSON 化して返す
    responseBody = {
        'arn': executionArn,
        'id': executionArn,
        **({'tags': tags} if tags else {}),
    }

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            **api_common.CORS_HEADERS,
        },
        'body': json.dumps(responseBody, default=api_common.default_serializer),
    }


def getVisualizer(dynamodb, workflowType: str, workflowId: str, visualizerId: str, roleArn: str):
    response = dynamodb.get_item(
        TableName=DYNAMODB_TABLE_NAME_WORKFLOW_VISUALIZERS,
        Key=api_common.dict_to_dynamodb({
            'workflowId': f'{workflowType}_{workflowId}',
            'visualizerId': visualizerId,
        }),
    )

    # DynamoDB から取得した情報を JSON 化して返す
    item = api_common.dict_from_dynamodb(response.get('Item'))

    return {
        'VisualizerId': visualizerId,
        'Name': item.get('name'),
        'StateMachineArn': item['stateMachineArn'],
        'RoleArn': roleArn,
    } if item else {}
