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
s3 = boto3.client('s3')
omics = boto3.client('omics')


# ワークフローの出力を扱う API を実装した Lambda 関数のハンドラ
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
    if not runId:
        # パスに実行 ID が含まれていなければ 404 Not Found とする
        return {
            'statusCode': 404,
            'headers': api_common.CORS_HEADERS,
        }

    queryParams = event.get('queryStringParameters') or {}

    try:
        # ワークフロー実行結果の情報を取得
        response = omics.get_run(id=runId)

        status = response.get('status')
        outputUri = response.get('outputUri')

        # ワークフローの出力先 S3 バケット名とプレフィックスを取得
        bucket, rootPrefix = api_common.get_bucket_and_key(outputUri, f'{runId}/')

        # ワークフローの実行が完了していないか、出力先情報がなければ 404 エラーとする
        if status != 'COMPLETED' or not bucket:
            return {
                'statusCode': 404,
                'headers': api_common.CORS_HEADERS,
            }

        path = pathParams.get('path')
        if not path:
            # パスに出力ファイルのパスが含まれていなかったら、全ての出力ファイルの一覧を返す
            return handle_list_objects(bucket, rootPrefix, '', queryParams)
        else:
            # パスが含まれていたら、そのパスに関する処理を行う
            if event['path'].endswith('/'):
                # 指定されたパスが '/' で終わっていたら、フォルダのブラウズとして扱う
                return handle_list_objects(bucket, rootPrefix, f'{path}/', queryParams)
            else:
                # そうでなければ、ファイルのダウンロードとして扱う
                return handle_get_object(bucket, rootPrefix, path, queryParams)

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


# 全ての出力ファイルの一覧を返す
def handle_list_objects(bucket: str, rootPrefix: str, path: str, queryParams: dict) -> dict:
    mode = queryParams.get('mode')
    maxKeys = queryParams.get('maxKeys')
    continuationToken = queryParams.get('continuationToken')

    # 指定された S3 パス以下のファイルとフォルダ一覧を取得する
    response = s3.list_objects_v2(
        Bucket=bucket,
        Prefix=f'{rootPrefix}{path}',
        **({'Delimiter': '/'} if mode == 'hierarchical' else {}),
        **({'MaxKeys': int(maxKeys)} if maxKeys else {}),
        **({'ContinuationToken': continuationToken} if continuationToken else {}),
    )

    # ファイルとフォルダ一覧を JSON 化して返す
    contents = response.get('Contents')
    commonPrefixes = response.get('CommonPrefixes')
    nextContinuationToken = response.get('NextContinuationToken')
    responseBody = {
        'contents': [{
            'path': content['Key'][len(rootPrefix):],
            'size': content['Size'],
        } for content in contents] if contents else [],
        'folders': [{
            'path': commonPrefix['Prefix'][len(rootPrefix):],
        } for commonPrefix in commonPrefixes] if commonPrefixes else [],
        **({'nextContinuationToken': nextContinuationToken} if nextContinuationToken else {}),
    }

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            **api_common.CORS_HEADERS,
        },
        'body': json.dumps(responseBody, default=api_common.default_serializer),
    }


# 指定された出力ファイルに関する処理を行う
def handle_get_object(bucket: str, rootPrefix: str, path: str, queryParams: dict) -> dict:
    # 指定された S3 ファイルの情報を取得する
    key = f'{rootPrefix}{path}'
    response = s3.head_object(Bucket=bucket, Key=key)
    if response['ContentLength'] == 0:
        # ファイルサイズが 0 であれば 404 Not Found とする
        return {
            'statusCode': 404,
            'headers': api_common.CORS_HEADERS,
        }

    # 指定された S3 ファイルをダウンロードするための署名付き URL を取得して返す
    # クエリーパラメーターで `attachment` が指定されていた場合、レスポンスの `Content-Disposition` が `attachment` となった URL とする事で、ブラウザにダウンロード動作を強制する
    attachment = api_common.string_to_bool(queryParams.get('attachment'))
    url = s3.generate_presigned_url(
        ClientMethod='get_object',
        Params={
            'Bucket': bucket,
            'Key': key,
            **({'ResponseContentDisposition': f'attachment'} if attachment else {})
        },
        ExpiresIn=3600,
    )

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            **api_common.CORS_HEADERS,
        },
        'body': url,
    }
