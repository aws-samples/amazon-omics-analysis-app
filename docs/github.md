# About GitHub Actions

This document describes the GitHub Actions workflows of this repository.

## Overview

| Name | File | Summary |
|---|---|---|
| Backend Dependency Check | [.github/workflows/backend-dependency-check.yml](../.github/workflows/backend-dependency-check.yml) | Checks that the lock file of the Lambda dependencies is up to date |
| CDK Synth | [.github/workflows/cdk-synth.yml](../.github/workflows/cdk-synth.yml) | Checks that the CDK app can be synthesized |
| Frontend Build | [.github/workflows/frontend-build.yml](../.github/workflows/frontend-build.yml) | Checks that the frontend can be built in the same environment as during deployment |

All workflows run on pull requests and on pushes to the `main` branch when related files change. Each workflow also runs when its own file changes.

## Backend Dependency Check

### What it does

When files under `backend/lambda` change, it runs `uv lock --check` in `/backend/lambda/layers/Common` directory to check that `uv.lock` matches the contents of `pyproject.toml`. It does not download or install packages.

### Notes

- The uv version is kept in sync with `UV_VERSION` in [cdk/lib/omics-analysis-app-stack.ts](../cdk/lib/omics-analysis-app-stack.ts). When you change one of them, also change the other.
- It does not check that the packages in `uv.lock` can be installed in the Lambda environment. This is checked by the CDK Synth workflow.
- If the check fails, `uv.lock` has not been updated to match `pyproject.toml`. Run `uv lock` in `/backend/lambda/layers/Common` directory and commit the updated `uv.lock`. If an update of a specific package causes the problem, running `uv lock --upgrade-package <name>` to regenerate `uv.lock` may solve it.

## CDK Synth

### What it does

When files under `cdk`, `backend/lambda`, `frontend` or `visualizer` change, it runs the following in `/cdk` directory.

1. `npm ci`
2. `npx tsc --noEmit`: Type check of the CDK code
3. `npx cdk synth --quiet -c lambdaArchitecture=arm64`: Synthesis of the CDK app, including bundling of the Lambda functions and layer (hash-verified installation from `uv.lock`)

Because the layer is bundled in a container of the Lambda architecture, the workflow runs on an ARM64 runner (`ubuntu-24.04-arm`).

### Notes

- When the CDK code starts to reference a new directory as an asset, add it to `paths` in `cdk-synth.yml`.
- When you change the Lambda architecture, change the value of `lambdaArchitecture` and the runner architecture together.
- The frontend is not built during `cdk synth`. The frontend build is checked by the Frontend Build workflow.
- It does not deploy to AWS.

## Frontend Build

### What it does

When files under `frontend` change, it runs `npm ci` and `npm run build` in `/frontend` directory in the same environment as CodeBuild uses during deployment, and checks that `dist/spa/index.html` is generated.

During deployment, the frontend is built by `NodejsBuild` in [cdk/lib/omics-analysis-app-stack.ts](../cdk/lib/omics-analysis-app-stack.ts) with the CodeBuild image `aws/codebuild/standard:7.0`. Because this image is not publicly available, the workflow builds the frontend in an environment that matches the following.

- OS: Ubuntu 22.04 (x86_64) container (same as the base of the CodeBuild image)
- Node.js and npm: same versions as the CodeBuild image (`NODE_VERSION` and `NPM_VERSION`)
- Resources: same as the CodeBuild compute type SMALL (3 GB memory, 2 vCPUs)
- Commands and environment variables: same as `buildCommands` and `buildEnvironment` of `NodejsBuild`. The values of the environment variables are only embedded in the build output, so the following dummy values are used

  | Environment variable | Dummy value |
  |---|---|
  | `VITE_API_URL` | `https://example.com/v1/` |
  | `VITE_AUTH_REGION` | `us-east-1` |
  | `VITE_AUTH_USER_POOL_ID` | `us-east-1_example` |
  | `VITE_AUTH_WEB_CLIENT_ID` | `example` |

### Notes

- AWS updates Node.js and npm in the CodeBuild image. Review `NODE_VERSION` and `NPM_VERSION` regularly and match them to `NODE_24_VERSION` and the npm version in the [Dockerfile](https://github.com/aws/aws-codebuild-docker-images/blob/master/ubuntu/standard/7.0/Dockerfile) of the CodeBuild image.
- When you change `nodejsVersion` or the build commands of `NodejsBuild`, also update this workflow.
- Other tools included in the CodeBuild image are not reproduced. If the build starts to use them, this workflow cannot detect the differences.
