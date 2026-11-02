# GitHub Actions について

このドキュメントでは、このリポジトリの GitHub Actions のワークフローについて説明します。

## 一覧

| 名前 | ファイル | 概要 |
|---|---|---|
| Backend Dependency Check | [.github/workflows/backend-dependency-check.yml](../.github/workflows/backend-dependency-check.yml) | Lambda の依存ライブラリのロックファイルが最新であることを確認する |
| CDK Synth | [.github/workflows/cdk-synth.yml](../.github/workflows/cdk-synth.yml) | CDK アプリを合成できることを確認する |
| Frontend Build | [.github/workflows/frontend-build.yml](../.github/workflows/frontend-build.yml) | フロントエンドをデプロイ時と同じ環境でビルドできることを確認する |

ワークフローはいずれも、PR と `main` ブランチへの push で、関係するファイルが変更された場合に実行されます。各ワークフローは、自身のファイルが変更された場合にも実行されます。

## Backend Dependency Check

### 実行している内容

`backend/lambda` 以下が変更された場合に、`/backend/lambda/layers/Common` ディレクトリで `uv lock --check` を実行し、`uv.lock` が `pyproject.toml` の内容と一致していることを確認します。パッケージのダウンロードやインストールは行いません。

### 注意点

- uv のバージョンは、[cdk/lib/omics-analysis-app-stack.ts](../cdk/lib/omics-analysis-app-stack.ts) の `UV_VERSION` と合わせています。どちらかを変更する場合は、もう片方も合わせて変更して下さい。
- `uv.lock` の内容を Lambda の環境にインストールできることは確認しません。これは CDK Synth のワークフローで確認します。
- チェックが失敗した場合は、`uv.lock` が `pyproject.toml` の内容に合わせて更新されていません。`/backend/lambda/layers/Common` ディレクトリで `uv lock` を実行し、更新された `uv.lock` をコミットして下さい。特定のパッケージの更新が原因の場合は、`uv lock --upgrade-package <パッケージ名>` を実行して `uv.lock` を作り直すことで解消できる場合があります。

## CDK Synth

### 実行している内容

`cdk`、`backend/lambda`、`frontend`、`visualizer` 以下が変更された場合に、`/cdk` ディレクトリで以下を実行します。

1. `npm ci`
2. `npx tsc --noEmit`: CDK のコードの型チェック
3. `npx cdk synth --quiet -c lambdaArchitecture=arm64`: CDK アプリの合成。Lambda 関数とレイヤーのバンドル (`uv.lock` からのハッシュ検証付きインストール) を含む

レイヤーは Lambda のアーキテクチャのコンテナでバンドルされるため、ARM64 のランナー (`ubuntu-24.04-arm`) で実行します。

### 注意点

- CDK のコードから新しいディレクトリをアセットとして参照する場合は、`cdk-synth.yml` の `paths` にも追加して下さい。
- Lambda のアーキテクチャを変更する場合は、`lambdaArchitecture` の値とランナーのアーキテクチャを合わせて変更して下さい。
- フロントエンドは `cdk synth` の時点ではビルドされません。フロントエンドのビルドは Frontend Build のワークフローで確認します。
- 実際の AWS へのデプロイは行いません。

## Frontend Build

### 実行している内容

`frontend` 以下が変更された場合に、デプロイ時に CodeBuild でビルドされるのと同じ環境で、`/frontend` ディレクトリで `npm ci` と `npm run build` を実行し、`dist/spa/index.html` が出力されることを確認します。

デプロイ時のビルドは、[cdk/lib/omics-analysis-app-stack.ts](../cdk/lib/omics-analysis-app-stack.ts) の `NodejsBuild` により、CodeBuild のイメージ `aws/codebuild/standard:7.0` で実行されます。このイメージは公開されていないため、以下をそろえた環境でビルドします。

- OS: Ubuntu 22.04 (x86_64) のコンテナ (CodeBuild のイメージのベースと同じ)
- Node.js と npm: CodeBuild のイメージと同じバージョン (`NODE_VERSION` と `NPM_VERSION`)
- リソース: CodeBuild のコンピューティングタイプ SMALL と同じ (メモリ 3 GB、2 vCPU)
- コマンドと環境変数: `NodejsBuild` の `buildCommands` と `buildEnvironment` と同じ。環境変数の値はビルド結果に埋め込まれるだけなので、以下のダミーの値を使う

  | 環境変数 | ダミーの値 |
  |---|---|
  | `VITE_API_URL` | `https://example.com/v1/` |
  | `VITE_AUTH_REGION` | `us-east-1` |
  | `VITE_AUTH_USER_POOL_ID` | `us-east-1_example` |
  | `VITE_AUTH_WEB_CLIENT_ID` | `example` |

### 注意点

- CodeBuild のイメージの Node.js と npm は AWS によって更新されます。`NODE_VERSION` と `NPM_VERSION` は、CodeBuild のイメージの [Dockerfile](https://github.com/aws/aws-codebuild-docker-images/blob/master/ubuntu/standard/7.0/Dockerfile) の `NODE_24_VERSION` と npm のバージョンに合わせて、定期的に見直して下さい。
- `NodejsBuild` の `nodejsVersion` やビルドコマンドを変更した場合は、このワークフローも合わせて変更して下さい。
- CodeBuild のイメージに含まれるその他のツールは再現していません。ビルドがそれらのツールを使うようになった場合は、このワークフローでは違いを確認できません。
