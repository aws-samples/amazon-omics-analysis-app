# REST API 仕様

## 共通仕様

### Authorization ヘッダー

ユーザー認証のため、Cognito が発行した [JSON Web Token (JWT)](https://ja.wikipedia.org/wiki/JSON_Web_Token) を HTTP リクエストの `Authorization` ヘッダーに以下のような形式で記述します。

```
Authorization: <token>
```

## ワークフローに関する API

ワークフロー (`Workflow`) は、以下のような定義の JSON データとして扱います。

| フィールド名          | 型       | 内容               | 値  |
| :------------------ | :------: | :---------------- | :-- |
| `id`                | `string` | ワークフロー ID     |     |
| `name`              | `string` | ワークフロー名      |     |
| `description`       | `string` | ワークフローの説明文 |     |
| `type`              | `string` | ワークフローの種別   | `PRIVATE`: ユーザーが登録したワークフロー |
| `parameterTemplate` | `object` | パラメーターテンプレート | パラメーター名をキー、`WorkflowParameterDefinition` を値とするオブジェクト |

`WorkflowParameterDefinition` の定義

| フィールド名    | 型        | 内容                | 値の例  |
| :------------ | :-------: | :----------------- | :----- |
| `description` | `string`  | パラメーターの説明    | 'Name of iGenomes reference' |
| `optional`    | `boolean` | 必須パラメーターか否か | `false`: 必須<br>`true`: 必須ではない |

### GET /workflows/`{workflowType}`

指定された種別のワークフロー一覧を返します。

#### リクエスト

クエリーパラメーター

| パラメーター名     | 型        | 必須 | 内容                   | 値  |
| :--------------- | :-------: | :-: | :--------------------- | :-- |
| `name`           | `string`  |     | 検索対象のワークフロー名   |     |
| `maxResults`     | `integer` |     | 一度に返すワークフローの数 |     |
| `startingToken`  | `string`  |     | 総数が `maxResults` を超えた場合、次のページを取得するためのトークン | 前回のレスポンスに含まれる `nextToken` を指定 |

リクエスト例

```
GET /workflows/PRIVATE?maxResults=100
```

#### レスポンス

Body

`Content-Type: application/json`

| フィールド名  | 型           | 内容                  |
| :---------- | :----------: | :------------------- |
| `items`     | `[Workflow]` | ワークフロー情報のリスト |
| `nextToken` | `string`     | 総数が `maxResults` を超えた場合、次のページを取得するためのトークン |

レスポンス例

```json
{
   "items": [
      {
         "id": "1111111",
         "name": "nf-core / rnaseq",
         "description": "RNA sequencing analysis pipeline using STAR, RSEM, HISAT2 or Salmon with gene/isoform counts and extensive quality control.",
         "type": "PRIVATE",
         "parameterTemplate": {
            "genome": {
               "description": "Name of iGenomes reference",
               "optional": true
            }
         }
      },
      {
         "id": "2222222",
         "name": "nf-core / scrnaseq",
         "description": "A single-cell RNAseq pipeline for 10X genomics data",
         "type": "PRIVATE",
         "parameterTemplate": {
            "genome": {
               "description": "Name of iGenomes reference",
               "optional": true
            }
         }
      }
   ],
   "nextToken": "xxxxxx"
}
```

#### 実装ファイル

[backend/lambda/functions/ApiGateway/WorkflowsApi/index.py](../backend/lambda/functions/ApiGateway/WorkflowsApi/index.py)

### GET /workflows/`{workflowType}`/`{workflowId}`

指定されたワークフローの詳細情報を返します。

#### リクエスト

リクエスト例

```
GET /workflows/PRIVATE/1111111
```

#### レスポンス

Body

`Content-Type: application/json`

レスポンス例

```json
{
   "id": "1111111",
   "name": "nf-core / rnaseq",
   "description": "RNA sequencing analysis pipeline using STAR, RSEM, HISAT2 or Salmon with gene/isoform counts and extensive quality control.",
   "type": "PRIVATE",
   "parameterTemplate": {
      "genome": {
         "description": "Name of iGenomes reference",
         "optional": true
      }
   }
}
```

## ワークフローの可視化に関する API

ワークフローで利用可能な可視化 (`WorkflowVisualization`) は、以下のような定義の JSON データとして扱います。

| フィールド名          | 型       | 内容           | 値  |
| :------------------ | :------: | :------------ | :-- |
| `workflowId`        | `string` | ワークフロー ID |     |
| `visualizationId`   | `string` | 可視化 ID      |     |
| `name`              | `string` | 可視化の表示名  |     |
| `stateMachineArn`   | `string` | 可視化を実行する Step Functions ステートマシンの ARN |     |

### GET /workflows/`{workflowType}`/`{workflowId}`/visualizations

指定されたワークフローで利用可能な可視化の一覧を返します。

#### リクエスト

クエリーパラメーター

| パラメーター名     | 型        | 必須 | 内容               | 値  |
| :--------------- | :-------: | :-: | :---------------- | :-- |
| `maxResults`     | `integer` |     | 一度に返す可視化の数 |     |
| `startingToken`  | `string`  |     | 総数が `maxResults` を超えた場合、次のページを取得するためのトークン | 前回のレスポンスに含まれる `nextToken` を指定 |

リクエスト例

```
GET /workflows/PRIVATE/1111111/visualizations?maxResults=100
```

#### レスポンス

Body

`Content-Type: application/json`

| フィールド名  | 型                        | 内容          |
| :---------- | :-----------------------: | :----------- |
| `items`     | `[WorkflowVisualization]` | 可視化のリスト |
| `nextToken` | `string`                  | 総数が `maxResults` を超えた場合、次のページを取得するためのトークン |

レスポンス例

```json
{
   "items": [
      {
         "workflowId": "1111111",
         "visualizationId": "tpm-dashboard",
         "name": "TPM visualization with dashboard",
         "stateMachineArn": "arn:aws:states:us-east-1:xxxx:stateMachine:xxxx"
      }
   ],
   "nextToken": "xxxxxx"
}
```

### GET /workflows/`{workflowType}`/`{workflowId}`/visualizations/`{visualizationId}`

指定されたワークフロー可視化の詳細情報を返します。

#### リクエスト

リクエスト例

```
GET /workflows/PRIVATE/1111111/visualizations/tpm-dashboard
```

#### レスポンス

Body

`Content-Type: application/json`

レスポンス例

```json
{
   "workflowId": "1111111",
   "visualizationId": "tpm-dashboard",
   "name": "TPM visualization with dashboard",
   "stateMachineArn": "arn:aws:states:us-east-1:xxxx:stateMachine:xxxx"
}
```

## ワークフローの実行内容に関する API

ワークフローの実行結果 (`Run`) は、以下のような定義の JSON データとして扱います。

| フィールド名        | 型        | 内容                  | 値  |
| :---------------- | :------:  | :------------------- | :-- |
| `id`              | `string`  | 実行 ID              |     |
| `name`            | `string`  | 実行名                | 'nf-core / rnaseq run 1' |
| `status`          | `string`  | 実行状態              | `PENDING`: 準備中<br>`STARTING`: 開始中<br>`RUNNING`: 実行中<br>`STOPPING`: 停止中<br>`COMPLETED`: 完了<br>`FAILED`: 失敗<br>`DELETED`: 削除<br>`CANCELLED`: キャンセル |
| `runGroupId`      | `string`  | 実行グループ ID        |     |
| `workflowId`      | `string`  | ワークフロー ID        |     |
| `workflowType`    | `string`  | ワークフローの種別      | `PRIVATE`: ユーザーが登録したワークフロー |
| `parameters`      | `object`  | 実行パラメーター       | キー: パラメーター名<br>値: 値 (スカラー) |
| `outputUri`       | `string`  | 出力先 S3 URL         |     |
| `priority`        | `integer` | 優先度                | `0`-`10000` (default: `100`) |
| `storageCapacity` | `integer` | ストレージ要求量 (GB)   | `0`-`9600` (default: `1200`) |
| `roleArn`         | `string`  | ワークフロー実行用ロール |     |
| `tags`            | `object`  | タグ                 | キー: タグ名<br>値: `string` |
| `creationTime`    | `string`  | 作成日時              | ISO8601 datetime |
| `startTime`       | `string`  | 開始日時              | ISO8601 datetime |
| `stopTime`        | `string`  | 終了日時              | ISO8601 datetime |

### GET /runs

ワークフロー実行結果の一覧を返します。

#### リクエスト

クエリーパラメーター

| パラメーター名    | 型        | 必須 | 内容               | 値  |
| :-------------- | :-------: | :-: | :----------------- | :-- |
| `runGroupId`    | `string`  |     | 検索対象の実行グループ |     |
| `name`          | `string`  |     | 検索対象の実行名      |     |
| `maxResults`    | `integer` |     | 一度に返す実行の数    |     |
| `startingToken` | `string`  |     | 総数が `maxResults` を超えた場合、次のページを取得するためのトークン | 前回のレスポンスに含まれる `nextToken` を指定 |

リクエスト例

```
GET /runs?maxResults=100
```

#### レスポンス

Body

`Content-Type: application/json`

| フィールド名  | 型       | 内容                  |
| :---------- | :------: | :------------------- |
| `items`     | `[Run]`  | ワークフロー情報のリスト |
| `nextToken` | `string` | 総数が `maxResults` を超えた場合、次のページを取得するためのトークン |

レスポンス例

```json
{
   "items": [
      {
         "id": "1111111",
         "name": "nf-core / rnaseq run 1",
         "status": "COMPLETED",
         "workflowId": "1111111",
         "workflowType": "PRIVATE",
         "parameters": {
            "genome": "GRCh38"
         },
         "outputUri": "s3://xxxx/",
         "priority": 100,
         "storageCapacity": 1200,
         "roleArn": "arn:aws:iam::000000000000:role/PrototypeXXXRole",
         "creationTime": "2023-04-01T00:00:00.000000+00:00",
         "startTime": "2023-04-01T01:00:00.000000+00:00",
         "stopTime": "2023-04-01T02:00:00.000000+00:00"
      },
      {
         "id": "2222222",
         "name": "nf-core / scrnaseq run 1",
         "status": "COMPLETED",
         "workflowId": "2222222",
         "workflowType": "PRIVATE",
         "parameters": {
            "genome": "GRCm38"
         },
         "outputUri": "s3://xxxx/",
         "priority": 100,
         "storageCapacity": 1200,
         "roleArn": "arn:aws:iam::000000000000:role/PrototypeXXXRole",
         "creationTime": "2023-04-01T00:00:00.000000+00:00",
         "startTime": "2023-04-01T01:00:00.000000+00:00",
         "stopTime": "2023-04-01T02:00:00.000000+00:00"
      }
   ],
   "nextToken": "xxxxxx"
}
```

### GET /runs/`{runId}`

指定されたワークフロー実行結果の詳細情報を返します。

#### リクエスト

リクエスト例

```
GET /runs/1111111
```

#### レスポンス

Body

`Content-Type: application/json`

レスポンス例

```json
{
   "id": "1111111",
   "name": "nf-core / rnaseq run 1",
   "status": "COMPLETED",
   "workflowId": "1111111",
   "workflowType": "PRIVATE",
   "parameters": {
      "genome": "GRCh38"
   },
   "outputUri": "s3://xxxx/",
   "priority": 100,
   "storageCapacity": 1200,
   "roleArn": "arn:aws:iam::000000000000:role/PrototypeXXXRole",
   "creationTime": "2023-04-01T00:00:00.000000+00:00",
   "startTime": "2023-04-01T01:00:00.000000+00:00",
   "stopTime": "2023-04-01T02:00:00.000000+00:00"
}
```

### POST /runs

ワークフローを新規実行します。

#### リクエスト

リクエスト例

```
POST /runs
```

Body

`Content-Type: application/json`

```json
{
   "name": "nf-core / rnaseq run 1",
   "workflowId": "1111111",
   "workflowType": "PRIVATE",
   "parameters": {
      "genome": "GRCh38"
   },
   "outputUri": "s3://xxxx/",
   "priority": 100,
   "storageCapacity": 1200,
   "roleArn": "arn:aws:iam::000000000000:role/PrototypeXXXRole"
}
```

#### レスポンス

Body

`Content-Type: application/json`

| フィールド名 | 型       | 内容       |
| :--------- | :------: | :-------- |
| `id`       | `string` | 実行 ID    |
| `arn`      | `string` | 実行の ARN |
| `status`   | `string` | ステータス  |
| `tags`     | `object` | タグ       |

レスポンス例

```json
{
   "id": "1111111",
   "arn": "arn:aws:omics:us-east-1:000000000000:run/1111111",
   "status": "COMPLETED"
}
```

## 実行タスクに関する API

ワークフローで実行されるタスク (`RunTask`) は、以下のような定義の JSON データとして扱います。

| フィールド名     | 型        | 内容        | 値  |
| :------------- | :-------: | :--------- | :-- |
| `taskId`       | `string`  | タスク ID   |     |
| `name`         | `string`  | タスク名    |     |
| `status`       | `string`  | 実行状態    | `PENDING`: 準備中<br>`STARTING`: 開始中<br>`RUNNING`: 実行中<br>`STOPPING`: 停止中<br>`COMPLETED`: 完了<br>`FAILED`: 失敗<br>`DELETED`: 削除<br>`CANCELLED`: キャンセル |
| `cpus`         | `integer` | CPU 使用量  | 単位はコア数 |
| `memory`       | `integer` | メモリ使用量 | 単位は GB |
| `creationTime` | `string`  | 作成日時    | ISO8601 datetime |
| `startTime`    | `string`  | 開始日時    | ISO8601 datetime |
| `stopTime`     | `string`  | 終了日時    | ISO8601 datetime |

### GET /runs/`{runId}`/tasks

指定された実行のタスク一覧を返します。

#### リクエスト

クエリーパラメーター

| パラメーター名     | 型        | 必須 | 内容                   | 値  |
| :--------------- | :-------: | :-: | :--------------------- | :-- |
| `status`         | `string`  |     | 検索対象の実行状態 | `PENDING`: 準備中<br>`STARTING`: 開始中<br>`RUNNING`: 実行中<br>`STOPPING`: 停止中<br>`COMPLETED`: 完了<br>`FAILED`: 失敗<br>`DELETED`: 削除<br>`CANCELLED`: キャンセル |
| `maxResults`     | `integer` |     | 一度に返すタスクの数 |     |
| `startingToken`  | `string`  |     | 総数が `maxResults` を超えた場合、次のページを取得するためのトークン | 前回のレスポンスに含まれる `nextToken` を指定 |

リクエスト例

```
GET /runs/1111111/tasks?maxResults=100
```

#### レスポンス

Body

`Content-Type: application/json`

| フィールド名  | 型          | 内容             |
| :---------- | :---------: | :-------------- |
| `items`     | `[RunTask]` | タスク情報のリスト |
| `nextToken` | `string`    | 総数が `maxResults` を超えた場合、次のページを取得するためのトークン |

レスポンス例

```json
{
   "items": [
      {
         "taskId": "1111111",
         "name": "NFCORE_RNASEQ:PROCESS1",
         "status": "COMPLETED",
         "cpus": 1,
         "memory": 6,
         "creationTime": "2023-04-01T00:00:00.000000+00:00",
         "startTime": "2023-04-01T01:00:00.000000+00:00",
         "stopTime": "2023-04-01T02:00:00.000000+00:00"
      },
      {
         "id": "2222222",
         "name": "NFCORE_RNASEQ:PROCESS2",
         "status": "COMPLETED",
         "cpus": 1,
         "memory": 6,
         "creationTime": "2023-04-01T00:00:00.000000+00:00",
         "startTime": "2023-04-01T01:00:00.000000+00:00",
         "stopTime": "2023-04-01T02:00:00.000000+00:00"
      }
   ],
   "nextToken": "xxxxxx"
}
```

### GET /runs/`{runId}`/tasks/`{taskId}`

指定されたタスクの詳細情報を返します。

#### リクエスト

リクエスト例

```
GET /runs/1111111/tasks/1111111
```

#### レスポンス

Body

`Content-Type: application/json`

レスポンス例

```json
{
   "taskId": "1111111",
   "name": "NFCORE_RNASEQ:PROCESS1",
   "status": "COMPLETED",
   "cpus": 1,
   "memory": 6,
   "creationTime": "2023-04-01T00:00:00.000000+00:00",
   "startTime": "2023-04-01T01:00:00.000000+00:00",
   "stopTime": "2023-04-01T02:00:00.000000+00:00"
}
```

## タスクのログに関する API

タスクのログイベント (`LogEvent`) は、以下のような定義の JSON データとして扱います。

| フィールド名      | 型        | 内容         | 値  |
| :-------------- | :-------: | :---------- | :-- |
| `message`       | `string`  | ログメッセージ |     |
| `timestamp`     | `integer` | メッセージのタイムスタンプ | UNIX epoch |
| `ingestionTime` | `integer` | メッセージが CloudWatch Logs に届いた日時 | UNIX epoch |

### GET /runs/`{runId}`/tasks/`{taskId}`/log

指定されたタスクのログイベント一覧を返します。

#### リクエスト

クエリーパラメーター

| パラメーター名    | 型        | 必須 | 内容          | 値  |
| :-------------- | :-------: | :-: | :----------- | :-- |
| `startFromHead` | `boolean` |     | ログの取得順序 | `true`: 最も古いログから取得する<br>`false`: 最も新しいログから取得する (デフォルト) |
| `unmask`        | `boolean` |     | 検索対象の実行状態 |     |
| `limit`         | `integer` |     | 一度のレスポンスで返すログの数 | `1`-`10000` デフォルト: `10000` |
| `nextToken`     | `string`  |     | 総数が `limit` を超えた場合、次のページを取得するためのトークン | 前回のレスポンスに含まれる `nextForwardToken` または `nextBackwardToken` を指定 |

リクエスト例

```
GET /runs/1111111/tasks/1111111/log?limit=100
```

#### レスポンス

Body

`Content-Type: application/json`

| フィールド名          | 型           | 内容        |
| :------------------ | :----------: | :--------- |
| `events`            | `[LogEvent]` | ログのリスト |
| `nextForwardToken`  | `string`     | 総数が `limit` を超えた場合、次のページを取得するためのトークン (`startFromHead` が `true` の時) |
| `nextBackwardToken` | `string`     | 総数が `limit` を超えた場合、次のページを取得するためのトークン (`startFromHead` が `false` の時) |

レスポンス例

```json
{
   "events": [
      {
         "message": "Task started",
         "timestamp": 1680307200,
         "ingestionTime": 1680310800
      },
      {
         "message": "Task finished",
         "timestamp": 1680307200,
         "ingestionTime": 1680310800
      }
   ],
   "nextBackwardToken": "xxxxxx"
}
```

## ワークフロー実行結果の出力ファイルに関する API

出力にはファイル (`File`) とフォルダ (`Folder`) があり、それぞれ以下のような定義の JSON データとして扱います。

ファイル

| フィールド名 | 型        | 内容         | 値  |
| :--------- | :-------: | :---------- | :-- |
| `path`     | `string`  | ファイルのパス | ワークフローの出力先 URL からの相対パス |
| `size`     | `integer` | ファイルサイズ |     |

フォルダ

| フィールド名 | 型        | 内容         | 値  |
| :--------- | :-------: | :---------- | :-- |
| `path`     | `string`  | フォルダのパス | ワークフローの出力先 URL からの相対パス |

### GET /runs/`{runId}`/outputs/`{path}`/

指定されたワークフロー実行結果の出力ファイル一覧を返します。path を指定した場合、ワークフローの出力先 URL からの相対パスとなります。

#### リクエスト

クエリーパラメーター

| パラメーター名        | 型         | 必須 | 内容        | 値  |
| :------------------ | :-------: | :-: | :---------- | :-- |
| `mode`              | `string`  |     | 一覧取得の動作 | `flat`: 指定パス以下の出力ファイル一覧を返す (デフォルト)<br>`hierarchical`: 指定パス直下のファイルとフォルダ一覧を返す |
| `maxKeys`           | `integer` |     | 一度のレスポンスで返すファイルの数 | `1`-`10000` デフォルト: `10000` |
| `continuationToken` | `string`  |     | 総数が `maxKeys` を超えた場合、次のページを取得するためのトークン | 前回のレスポンスに含まれる `nextContinuationToken` を指定 |

リクエスト例

```
GET /runs/1111111/outputs?maxKeys=100
```

#### レスポンス

Body

`Content-Type: application/json`

| フィールド名              | 型         | 内容        |
| :---------------------- | :--------: | :--------- |
| `contents`              | `[File]`   | ファイルのリスト |
| `folders`               | `[Folder]` | フォルダのリスト |
| `nextContinuationToken` | `string`   | 総数が `maxKeys` を超えた場合、次のページを取得するためのトークン |

レスポンス例

```json
{
   "contents": [
      {
         "path": "summary.html",
         "size": 102400
      },
      {
         "path": "report.pdf",
         "size": 1048576
      }
   ],
   "nextContinuationToken": "xxxxxx"
}
```

### GET /runs/`{runId}`/outputs/`{path}`

指定された出力ファイルをダウンロードするための URL を返します。

#### リクエスト

リクエスト例

```
GET /runs/1111111/outputs/report.pdf
```

#### レスポンス

Body

`Content-Type: application/json`

S3 の Pre-signed URL を返します。

## ワークフロー実行結果の可視化に関する API

ワークフロー実行結果の可視化 (`RunVisualization`) は、以下のような定義の JSON データとして扱います。

| フィールド名        | 型       | 内容      | 値  |
| :---------------- | :------: | :------- | :-- |
| `runId`           | `string` | 実行 ID   |     |
| `visualizationId` | `string` | 可視化 ID |     |
| `dashboardId`     | `string` | QuickSight ダッシュボードの ID  |     |

### GET /runs/`{runId}`/visualizations

指定されたワークフロー実行結果の可視化の一覧を返します。

#### リクエスト

クエリーパラメーター

| パラメーター名     | 型        | 必須 | 内容               | 値  |
| :--------------- | :-------: | :-: | :---------------- | :-- |
| `maxResults`     | `integer` |     | 一度に返す可視化の数 |     |
| `startingToken`  | `string`  |     | 総数が `maxResults` を超えた場合、次のページを取得するためのトークン | 前回のレスポンスに含まれる `nextToken` を指定 |

リクエスト例

```
GET /runs/1111111/visualizations?maxResults=100
```

#### レスポンス

Body

`Content-Type: application/json`

| フィールド名  | 型                   | 内容          |
| :---------- | :------------------: | :----------- |
| `items`     | `[RunVisualization]` | 可視化のリスト |
| `nextToken` | `string`             | 総数が `maxResults` を超えた場合、次のページを取得するためのトークン |

レスポンス例

```json
{
   "items": [
      {
         "runId": "1111111",
         "visualizationId": "tpm-dashboard",
         "dashboardId": "prototype_rna_seq_dashboard"
      }
   ],
   "nextToken": "xxxxxx"
}
```

### GET /runs/`{runId}`/visualizations/`{visualizationId}`

指定された可視化の詳細情報を返します。

#### リクエスト

リクエスト例

```
GET /runs/1111111/visualizations/tpm-dashboard
```

#### レスポンス

Body

`Content-Type: application/json`

レスポンス例

```json
{
   "runId": "1111111",
   "visualizationId": "tpm-dashboard",
   "dashboardId": "prototype_rna_seq_dashboard"
}
```

### GET /runs/`{runId}`/visualizations/`{visualizationId}`/dashboard

指定されたワークフロー実行結果の可視化ダッシュボードを表示するための URL を返します。

#### リクエスト

リクエスト例

```
GET /runs/1111111/visualizations/tpm-dashboard/dashboard
```

#### レスポンス

Body

`Content-Type: application/json`

ダッシュボードの URL を返します。
