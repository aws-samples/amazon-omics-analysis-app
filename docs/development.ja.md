# ローカル環境での開発

このドキュメントでは、ローカル環境でこのアプリケーションを開発する方法を説明します。

## Lambda 関数の開発

Lambda 関数が利用する外部 Python ライブラリは、Common レイヤーにまとめて [uv](https://docs.astral.sh/uv/) で管理しています。依存ライブラリは [backend/lambda/layers/Common/pyproject.toml](../backend/lambda/layers/Common/pyproject.toml) で宣言し、推移的な依存も含めた全パッケージのバージョンとハッシュを [uv.lock](../backend/lambda/layers/Common/uv.lock) で固定しています。
`cdk deploy` 時には、CDK が Docker コンテナ内で `uv.lock` の内容をハッシュを検証しながらレイヤーにインストールします。デプロイするだけであれば、ローカル環境に uv は不要です。

### ローカル環境

`/backend/lambda/layers/Common` ディレクトリで以下のコマンドを実行して下さい。Lambda ランタイムと同じ Python 3.14 と依存ライブラリが `.venv` にインストールされます。`.venv` はレイヤーには含まれません。

```
uv sync
uv run pytest
```

Lambda 関数のコードを動かす場合は、`/backend/lambda` ディレクトリで `--project` に Common レイヤーを指定して実行して下さい。Lambda 実行時と同様に `api_common` を import するため、`layers/Common` を `PYTHONPATH` に追加します (pytest では設定済みです)。

```
PYTHONPATH=layers/Common:functions/ApiGateway/WorkflowsApi uv run --project layers/Common python -c "import index"
```

`functions` の下にできた `__pycache__` ディレクトリは Lambda 関数のアセットに含まれてしまうため、デプロイ前に削除して下さい。

### 依存ライブラリの更新

`/backend/lambda/layers/Common` ディレクトリで以下の手順を実行して下さい。

1. `pyproject.toml` の `dependencies` を編集して `uv lock` を実行するか、`uv lock --upgrade-package <パッケージ名>` (全て更新する場合は `uv lock --upgrade`) を実行します。
2. `pyproject.toml` と `uv.lock` をまとめてコミットします。

### 脆弱性の確認

ローカル環境で依存ライブラリの脆弱性を確認する場合は、`/backend/lambda/layers/Common` ディレクトリで以下のコマンドを実行して下さい (uv の実験的な機能です)。

```
uv audit --frozen --no-dev
```

### uv のバージョン

レイヤーのバンドルに使う uv のバージョンは、[cdk/lib/omics-analysis-app-stack.ts](../cdk/lib/omics-analysis-app-stack.ts) の `UV_VERSION` で指定しています。変更する場合は、GitHub Actions のワークフローの uv のバージョンも合わせて変更して下さい ([GitHub Actions について](github.ja.md#backend-dependency-check) を参照)。

## フロントエンドの開発

ローカル環境で起動したフロントエンドは、AWS 上にデプロイした開発用のバックエンドに接続して動作確認します。

### 開発用ステージのデプロイ

`stage` に `dev` を指定してデプロイしたスタックだけ、ローカル環境のフロントエンド (`http://localhost:9000`) からの接続が CORS で許可されます。それ以外のスタックで許可されるのは CloudFront の URL だけです。

`/cdk` ディレクトリで以下のコマンドを実行して下さい。`dev-OmicsAnalysisAppStack` という名前で、本番用とは別のスタックが作成されます。

```
npm ci
npx cdk deploy -c stage=dev dev/OmicsAnalysisAppStack --require-approval never
```

開発用ステージの CloudFront の URL (`FrontendURL`) から開いた画面も、これまでどおり利用できます。

### 環境変数の設定

開発用スタックの出力を確認します。

```
aws cloudformation describe-stacks --region us-east-1 --stack-name dev-OmicsAnalysisAppStack --query "Stacks[0].Outputs[].[OutputKey,OutputValue]" --output table
```

`/frontend` ディレクトリに `.env.local` を作成し、出力の値を以下のように設定して下さい。`.env.local` の値は `.env` より優先されます。`.env.local` は Git の管理対象外です。

```
# バックエンドAPIのエンドポイント (BackendApiURL)
VITE_API_URL=https://xxxx.execute-api.us-east-1.amazonaws.com/v1/
# CognitoユーザープールID (CognitoUserPoolId)
VITE_AUTH_USER_POOL_ID=us-east-1_xxxx
# CognitoユーザープールクライアントID (CognitoUserPoolClientId)
VITE_AUTH_WEB_CLIENT_ID=xxxx
```

### 開発サーバーの起動

`/frontend` ディレクトリで以下のコマンドを実行して下さい。開発サーバーが `http://localhost:9000` で起動し、ブラウザが開きます。開発サーバーには自分のマシンからのみ接続できます。

```
npm ci
npm run dev
```

ソースコードを変更すると、画面に自動で反映されます。開発用ステージは本番用とは別の Cognito ユーザープールを使うため、初回は [サインイン](../README.ja.md#サインイン) の手順でアカウントを作成して下さい。

### 注意事項

- ブラウザでは `http://localhost:9000` を開いて下さい。`http://127.0.0.1:9000` から開くと、Origin が一致しないため CORS エラーになります。
- ポート 9000 が他のプロセスに使われていると、開発サーバーは別のポートで起動し、CORS エラーになります。ポート 9000 を空けてから起動し直して下さい。
- Cognito の認証に失敗した場合、API Gateway が返す 401 レスポンスには CORS のヘッダーが付かないため、ブラウザには CORS エラーとして表示されます。サインインし直しても解消しない場合は、`.env.local` の値が開発用スタックの出力と一致しているか確認して下さい。
- Lambda 関数など、バックエンドの変更を反映するには、開発用ステージをもう一度デプロイして下さい。

## npm の設定

`/frontend` と `/cdk` では、サプライチェーン攻撃への対策として、`.npmrc` と `package.json` で npm の動作を制限しています。これらの設定には npm 11.10.0 以降が必要です。

| 設定 | 場所 | 内容 |
|---|---|---|
| `allowScripts` | `package.json` | 依存パッケージのインストールスクリプト (`preinstall`、`install`、`postinstall`) を実行してよいかを、パッケージごとに記録します。現在は、スクリプトを持つパッケージをすべて `false` (実行しない) にしています |
| `strict-allow-scripts=true` | `.npmrc` | `allowScripts` に記録されていないパッケージがインストールスクリプトを持っている場合、インストールをエラーにします |
| `min-release-age=1` | `.npmrc` | `npm install` や `npm update` で、公開から 1 日経っていないバージョンを選びません。`package-lock.json` で固定済みのバージョンは、`npm ci` ではこの設定に関係なくインストールされます |
| `allow-git=none`、`allow-remote=none` | `.npmrc` | git リポジトリや URL を取得元とする依存パッケージをインストールしません |

依存パッケージを追加・更新したときに、以下のようなエラーでインストールが失敗した場合は、新しくインストールスクリプトを持つパッケージが加わっています。

```
npm error code ESTRICTALLOWSCRIPTS
```

スクリプトの内容を確認し、実行しなくても動作する場合は `npm deny-scripts <パッケージ名>`、実行が必要な場合は `npm approve-scripts <パッケージ名>` を実行して、`package.json` の変更をコミットして下さい。`npm deny-scripts --all` を実行すると、未確認のパッケージをまとめて `false` にできます。
