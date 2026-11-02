import os
import functools
import collections.abc as collections_abc
from datetime import date, datetime, timezone
from decimal import Decimal
from boto3.dynamodb.types import TypeSerializer, TypeDeserializer

# 複数の Lambda 関数で共通利用するヘルパー関数を集めたライブラリ

# CORS で許可する Origin の一覧を環境変数から取得 (カンマ区切りで複数指定可能)
CORS_ALLOW_ORIGINS = [origin.strip() for origin in os.environ['CORS_ALLOW_ORIGINS'].split(',') if origin.strip()]


# リクエストヘッダーの値を、ヘッダー名の大文字小文字を区別せずに取得する
def get_header(headers: dict | None, name: str) -> str | None:
    name = name.lower()
    for key, value in (headers or {}).items():
        if key.lower() == name:
            return value
    return None


# リクエストの Origin が許可されていればその Origin を、許可されていなければ既定の Origin を返す
def allowed_origin(headers: dict | None) -> str:
    origin = get_header(headers, 'origin')
    # 先頭の Origin (CloudFront の URL) を、リクエストの Origin が一覧に無い場合の既定値とする
    return origin if origin in CORS_ALLOW_ORIGINS else CORS_ALLOW_ORIGINS[0]


# Lambda 関数のハンドラーが返すレスポンスに、Cross-Origin Resource Sharing (CORS) のレスポンスヘッダーを設定するデコレーター
# https://developer.mozilla.org/ja/docs/Web/HTTP/CORS
# REST API の全ハンドラーに付けること。付けないとブラウザからの呼び出しが CORS エラーになる
# Access-Control-Allow-Methods と Access-Control-Allow-Headers はプリフライト (OPTIONS) のレスポンスでのみ参照されるため、
# プリフライトに応答する API Gateway 側 (cdk/lib/constructs/backend-apigateway.ts の defaultCorsPreflightOptions) で設定している
def cors(handler):
    @functools.wraps(handler)
    def wrapper(event: dict, context) -> dict:
        response = handler(event, context)
        if isinstance(response, dict):
            response['headers'] = {
                **(response.get('headers') or {}),
                'Access-Control-Allow-Origin': allowed_origin(event.get('headers')),
                # Origin によってレスポンスが変わることをキャッシュに伝える
                'Vary': 'Origin',
            }
        return response
    return wrapper


# json.loads() や json.dumps() で datetime や date 型を JSON 化できるようにするためのカスタムシリアライザー
def default_serializer(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()

    raise TypeError(f'{type(obj)} is not serializable')


# S3 URL をバケット名とキーに分割する
def get_bucket_and_key(url, key):
    if not url.startswith('s3://'):
        return None, None

    bucket, *keys = url[len('s3://'):].split('/', 1)
    rootPrefix = keys[0].rstrip('/') if keys else ''
    key = f'{rootPrefix}/{key}' if rootPrefix else f'{key}'
    return bucket, key


# 文字列を `bool` 型に変換する
def string_to_bool(str):
    return str.lower() in ['true', '1', 'yes'] if str else False



# UNIX 時間の数値を `datetime` 型に変換する
def datetime_from_timestamp(obj):
    return datetime.fromtimestamp(obj, timezone.utc) if obj else None


# 値を DynamoDB に格納できる型に変換する
def value_to_dynamodb(obj):
    if isinstance(obj, float):
        return Decimal(obj)
    elif isinstance(obj, collections_abc.Set):
        return set(map(value_to_dynamodb, obj))
    elif isinstance(obj, collections_abc.Mapping):
        return { key: value_to_dynamodb(value) for key, value in obj.items() }
    elif isinstance(obj, tuple):
        return tuple( value_to_dynamodb(value) for value in obj )
    elif isinstance(obj, list):
        return [ value_to_dynamodb(value) for value in obj ]
    else:
        return obj


_serializer = TypeSerializer()

# `dict` の内容を DynamoDB に変換できる形式に変換する
def dict_to_dynamodb(obj):
    return {
        key: _serializer.serialize(value_to_dynamodb(value))
        for key, value in obj.items()
    } if obj else {}


# DynamoDB から取得した値を一般的な型に変換する
def value_from_dynamodb(obj):
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    elif isinstance(obj, collections_abc.Set):
        return set(map(value_from_dynamodb, obj))
    elif isinstance(obj, collections_abc.Mapping):
        return { key: value_from_dynamodb(value) for key, value in obj.items() }
    elif isinstance(obj, tuple):
        return tuple( value_from_dynamodb(value) for value in obj )
    elif isinstance(obj, list):
        return [ value_from_dynamodb(value) for value in obj ]
    else:
        return obj


_deserializer = TypeDeserializer()

# DynamoDB から取得したレコードを一般的な `dict` 形式に変換する
def dict_from_dynamodb(obj):
    return {
        key: value_from_dynamodb(_deserializer.deserialize(value))
        for key, value in obj.items()
    } if obj else {}
