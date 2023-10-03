import os
import io
import sys
import time
import json
import tarfile
import boto3
import mimetypes

from awsglue.utils import getResolvedOptions

# Glue タスクに渡されたコマンドラインパラメーターを解析する
args = getResolvedOptions(sys.argv, [
    'DYNAMODB_TABLE_NAME_RUN_VISUALIZATIONS',

    'analysis_id',
    'user_id',
    'run_id',
    'output_uri',
    'visualizer_id',
])

# DynamoDB テーブルの ARN を取得
DYNAMODB_TABLE_NAME_RUN_VISUALIZATIONS = args['DYNAMODB_TABLE_NAME_RUN_VISUALIZATIONS']

# S3 のクライアントを初期化
s3 = boto3.client('s3')

# DynamoDB のクライアントを初期化
dynamodb = boto3.client('dynamodb')


# AlphaFold の実行結果の可視化を行う Step Functions タスクを実装した Glue python shell ジョブ
def main():
    runId = args['run_id']
    outputUri = args['output_uri']
    visualizerId = args['visualizer_id']

    # Omics ワークフローの出力先バケットとルートディレクトリのキーを取得
    bucket, *keys = outputUri[len('s3://'):].split('/', 1)
    rootPrefix = keys[0].rstrip('/') if keys else ''
    rootKey = f'{rootPrefix}/{runId}' if rootPrefix else runId

    # 'out/prediction/results.tar.gz' を解凍する
    resultsObject = s3.get_object(Bucket=bucket, Key=f'{rootKey}/out/prediction/results.tar.gz')
    resultsBody = resultsObject['Body'].read()
    with tarfile.open(fileobj=io.BytesIO(resultsBody), mode='r') as resultsFile:
        for member in resultsFile.getmembers():
            memberName = os.path.normpath(member.name)
            if memberName != '.':
                # 解凍したファイルを S3 にアップロードする
                file = resultsFile.extractfile(member)
                contentType, contentEncoding = mimetypes.guess_type(memberName)
                s3.upload_fileobj(
                    Fileobj=file,
                    Bucket=bucket,
                    Key=f'{rootKey}/out/prediction/{memberName}',
                    ExtraArgs={
                        **({'ContentType': contentType} if contentType else {}),
                        **({'ContentEncoding': contentEncoding} if contentEncoding else {}),
                    },
                )

                # ファイルの拡張子が .pdb であれば、3Dmol による可視化の対象として DynamoDB に登録する
                fileName, ext = os.path.splitext(memberName)
                if ext.lower() == '.pdb':
                    # PDB ファイルのパスを DynamoDB に書き込む
                    response = dynamodb.put_item(
                        TableName=DYNAMODB_TABLE_NAME_RUN_VISUALIZATIONS,
                        Item={
                            'runId': {
                                'S': runId,
                            },
                            'visualizationId': {
                                'S': f'{visualizerId}_{fileName}',
                            },
                            'type': {
                                'S': '3Dmol',
                            },
                            'pdbPath': {
                                'S': f'out/prediction/{memberName}',
                            },
                        },
                    )


if __name__ == "__main__":
    try:
        main()

    except FileNotFoundError as err:
        print(f'Error: {err}')
