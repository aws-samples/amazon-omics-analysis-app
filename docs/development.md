# Local development

This document describes how to develop this application in your local environment.

## Lambda development

The external Python libraries used by the Lambda functions are bundled in the Common layer and managed with [uv](https://docs.astral.sh/uv/). They are declared in [backend/lambda/layers/Common/pyproject.toml](../backend/lambda/layers/Common/pyproject.toml), and the versions and hashes of all packages (including transitive dependencies) are locked in [uv.lock](../backend/lambda/layers/Common/uv.lock).
During `cdk deploy`, CDK installs the packages in `uv.lock` into the layer in a Docker container, verifying their hashes. uv is not required in your local environment just to deploy.

### Local environment

Execute the following commands in `/backend/lambda/layers/Common` directory. uv installs Python 3.14 (same as the Lambda runtime) and all dependencies into `.venv`. `.venv` is not included in the layer.

```
uv sync
uv run pytest
```

To run the code of a Lambda function, execute it in `/backend/lambda` directory with the Common layer specified by `--project`. Add `layers/Common` to `PYTHONPATH` to import `api_common` as in the Lambda runtime (already configured for pytest).

```
PYTHONPATH=layers/Common:functions/ApiGateway/WorkflowsApi uv run --project layers/Common python -c "import index"
```

Delete `__pycache__` directories under `functions` before deployment, because they are included in the Lambda function assets.

### Updating dependencies

Execute the following steps in `/backend/lambda/layers/Common` directory.

1. Edit `dependencies` in `pyproject.toml` and run `uv lock`, or upgrade packages with `uv lock --upgrade-package <name>` (`uv lock --upgrade` for all).
2. Commit `pyproject.toml` and `uv.lock` together.

### Checking vulnerabilities

To check vulnerabilities in the dependencies in your local environment, execute the following command in `/backend/lambda/layers/Common` directory (an experimental feature of uv).

```
uv audit --frozen --no-dev
```

### uv version

The uv version used to bundle the layer is specified by `UV_VERSION` in [cdk/lib/omics-analysis-app-stack.ts](../cdk/lib/omics-analysis-app-stack.ts). When you change it, also change the uv version in the GitHub Actions workflows (see [About GitHub Actions](github.md#backend-dependency-check)).

## Frontend development

The frontend running in your local environment connects to a development backend deployed on AWS.

### Deploy the development stage

Only the stack deployed with `stage` set to `dev` allows connections (CORS) from the local frontend (`http://localhost:9000`). Other stacks allow only the CloudFront URL.

Execute the following commands in `/cdk` directory. A separate stack named `dev-OmicsAnalysisAppStack` is created.

```
npm ci
npx cdk deploy -c stage=dev dev/OmicsAnalysisAppStack --require-approval never
```

The application opened from the CloudFront URL (`FrontendURL`) of the development stage also works as before.

### Set environment variables

Check the outputs of the development stack.

```
aws cloudformation describe-stacks --region us-east-1 --stack-name dev-OmicsAnalysisAppStack --query "Stacks[0].Outputs[].[OutputKey,OutputValue]" --output table
```

Create `.env.local` in `/frontend` directory and set the output values as follows. Values in `.env.local` take precedence over `.env`. `.env.local` is ignored by Git.

```
# Backend API endpoint (BackendApiURL)
VITE_API_URL=https://xxxx.execute-api.us-east-1.amazonaws.com/v1/
# Cognito user pool ID (CognitoUserPoolId)
VITE_AUTH_USER_POOL_ID=us-east-1_xxxx
# Cognito user pool client ID (CognitoUserPoolClientId)
VITE_AUTH_WEB_CLIENT_ID=xxxx
```

### Start the development server

Execute the following commands in `/frontend` directory. The development server starts at `http://localhost:9000` and a browser opens. Only your own machine can connect to the development server.

```
npm ci
npm run dev
```

Changes to the source code are reflected in the browser automatically. The development stage uses a Cognito user pool separate from the production one, so create an account first by following [Sign in](../README.md#sign-in).

### Notes

- Open `http://localhost:9000` in your browser. `http://127.0.0.1:9000` causes CORS errors because the Origin does not match.
- If port 9000 is used by another process, the development server starts on another port and CORS errors occur. Free port 9000 and start the server again.
- When Cognito authentication fails, the 401 response from API Gateway has no CORS headers, so the browser shows it as a CORS error. If signing in again does not help, check that the values in `.env.local` match the outputs of the development stack.
- To apply backend changes such as Lambda functions, deploy the development stage again.

## npm settings

In `/frontend` and `/cdk`, `.npmrc` and `package.json` restrict the behavior of npm as a countermeasure against supply-chain attacks. These settings require npm 11.10.0 or later.

| Setting | Location | Description |
|---|---|---|
| `allowScripts` | `package.json` | Records, per package, whether the install scripts (`preinstall`, `install`, `postinstall`) of a dependency may run. Currently all packages with install scripts are set to `false` (not run) |
| `strict-allow-scripts=true` | `.npmrc` | Fails the install if a dependency has install scripts and is not recorded in `allowScripts` |
| `min-release-age=1` | `.npmrc` | `npm install` and `npm update` do not select versions published less than 1 day ago. Versions already locked in `package-lock.json` are installed by `npm ci` regardless of this setting |
| `allow-git=none`, `allow-remote=none` | `.npmrc` | Does not install dependencies fetched from git repositories or URLs |

If the install fails with the following error after you add or update dependencies, a package with install scripts has been added.

```
npm error code ESTRICTALLOWSCRIPTS
```

Review the scripts. If the package works without them, run `npm deny-scripts <name>`; if they are required, run `npm approve-scripts <name>`. Then commit the change to `package.json`. `npm deny-scripts --all` sets all unreviewed packages to `false` at once.
