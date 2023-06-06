import json
import botocore
import boto3
import email.mime.text

from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext

# ログとトレースの機能を初期化
logger = Logger()
tracer = Tracer()

# SES のクライアントを初期化
ses = boto3.client('ses')


# Omics ワークフローの完了を通知する Step Functions タスクを実装した Lambda 関数のハンドラ
# CloudWatch Logs と X-Ray によるログとトレースを有効化
@tracer.capture_lambda_handler
@logger.inject_lambda_context(log_event=True)
def handler(event: dict, context: LambdaContext) -> dict:
    # Step Functions ステートマシンから渡されたパラメーターからワークフローの実行結果を取得する
    omicsRun = event['OmicsRun']
    runId = omicsRun['RunId']
    isError = omicsRun['IsError']
    status = omicsRun['Status']
    statusMessage = omicsRun['StatusMessage']
    analysisName = omicsRun.get('Name')
    parameters = omicsRun['Parameters']

    # 通知先のメールアドレス、フロントエンドの URL や使用言語の情報を取得する
    notification = event['Notification']
    emailAddress = notification['Email']
    frontendOrigin = notification['FrontendOrigin']
    acceptLanguage = notification['AcceptLanguage']
    language = acceptLanguage.split(';')[0].split(',')[0].split('-')[0]

    sender = emailAddress
    recipients = [emailAddress]

    # 実行結果の詳細情報を表示するためのリンクを構築する
    linkToDetailsPage = f'{frontendOrigin}/#/analysis/result/{runId}'

    # 実行結果や言語に応じて件名と本文を設定
    if not isError:
        if language == 'ja':
            subject = f"分析 '{analysisName or runId}' が完了しました"
            body = f"""\
詳細情報: {linkToDetailsPage}
パラメータ: {json.dumps(parameters, indent=2)}
"""
        else:
            subject = f"Analysis '{analysisName or runId}' completed successfully"
            body = f"""\
View details: {linkToDetailsPage}
Parameters: {json.dumps(parameters, indent=2)}
"""

    else:
        if language == 'ja':
            subject = f"分析 '{analysisName or runId}' が失敗しました"
            body = f"""\
詳細情報: {linkToDetailsPage}
ステータス: {status}
ステータスメッセージ: {statusMessage or 'N/A'}
パラメータ: {json.dumps(parameters, indent=2)}
"""
        else:
            subject = f"Analysis '{analysisName or runId}' failed"
            body = f"""\
View details: {linkToDetailsPage}
Status: {status}
StatusMessage: {statusMessage or 'N/A'}
Parameters: {json.dumps(parameters, indent=2)}
"""

    # 件名と本文をMIMEエンコード
    message = email.mime.text.MIMEText(body, 'plain', 'utf-8')
    message['Subject'] = subject
    message['From'] = sender
    message['To'] = ', '.join(recipients)

    try:
        # SESを使ってメール送信
        response = ses.send_raw_email(
            Source=sender,
            Destinations=recipients,
            RawMessage={
                'Data': message.as_string(),
            },
        )

        # 送信内容とメッセージ ID を返す
        return {
            'Email': {
                'MessageId': response['MessageId'],
                'Sender': sender,
                'Recipients': recipients,
                'Subject': subject,
                'Body': body,
            },
        }

    except botocore.exceptions.ClientError as err:
        code = err.response['Error']['Code']
        message = err.response['Error']['Message']
        logger.exception(f'{code}: {message}')

        # AWS の API からエラーレスポンスが返されたら、その内容に準じたエラーコードとメッセージを返す
        return {
            'Email': {
                'Error': code,
                'ErrorMessage': message,
                'Sender': sender,
                'Recipients': recipients,
                'Subject': subject,
                'Body': body,
            }
        }

    except Exception as err:
        code = type(err).__name__
        message = str(err)
        logger.exception(f'{code}: {message}')

        # その他のエラーが発生したら、エラー種別とメッセージを返す
        return {
            'Email': {
                'Error': code,
                'ErrorMessage': message,
                'Sender': sender,
                'Recipients': recipients,
                'Subject': subject,
                'Body': body,
            }
        }
