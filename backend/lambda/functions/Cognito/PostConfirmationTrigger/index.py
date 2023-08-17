import os
import boto3

from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext

# ログとトレースの機能を初期化
logger = Logger()
tracer = Tracer()

AWS_ACCOUNT_ID = os.environ['AWS_ACCOUNT_ID']

# QuickSight のサインアップを行ったリージョンを環境変数から取得
QUICKSIGHT_IDENTITY_REGION = os.environ['QUICKSIGHT_IDENTITY_REGION']

# QuickSight ユーザーの名前空間を環境変数から取得
QUICKSIGHT_USER_NAMESPACE = os.environ['QUICKSIGHT_USER_NAMESPACE']

# QuickSight の ID フェデレーション用ロールの ARN を環境変数から取得
QUICKSIGHT_FEDERATION_ROLE_ARN = os.environ['QUICKSIGHT_FEDERATION_ROLE_ARN']

# AWS サービスのクライアントを初期化
quicksight = boto3.client('quicksight', region_name=QUICKSIGHT_IDENTITY_REGION)


# CloudWatch Logs と X-Ray によるログとトレースを有効化
@tracer.capture_lambda_handler
@logger.inject_lambda_context(log_event=True)
def handler(event: dict, context: LambdaContext) -> dict:
    # Cognito から渡されたユーザー情報を取得する
    userAttributes = event['request']['userAttributes']
    userId = userAttributes['sub']
    email = userAttributes['email']

    # ユーザーによるセルフサインアップ、または Azure AD などの外部 ID プロバイダーからのユーザー登録が完了した場合、ユーザーの情報を MySQL に登録する
    userStatus = userAttributes['cognito:user_status']
    if userStatus == 'CONFIRMED' or userStatus == 'EXTERNAL_PROVIDER':
        registerUserResponse = quicksight.register_user(
            IdentityType='IAM',
            Email=email,
            UserRole='READER',
            IamArn=QUICKSIGHT_FEDERATION_ROLE_ARN,
            SessionName=userId,
            AwsAccountId=AWS_ACCOUNT_ID,
            Namespace=QUICKSIGHT_USER_NAMESPACE,
            ExternalLoginFederationProviderType='COGNITO',
            ExternalLoginId=userId,
        )
        quickSightUser = registerUserResponse['User']

        quickSightUserName = quickSightUser['UserName']
        logger.info(f'Registered QuickSight user {quickSightUserName} ({email}) (Cognito user ID: {userId})')

    return event
