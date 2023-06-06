#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';

import { BackendStack } from '../lib/backend-stack';
import { FrontendStack } from '../lib/frontend-stack';

const app = new cdk.App();

// cdk.json から各種設定を読み込む
const stageName: string | undefined = app.node.tryGetContext('stage');

// プロトタイプへの接続を許可するアクセス元 IP アドレスの CIDR 一覧
const ipv4Ranges: string[] | undefined = app.node.tryGetContext("allowdIPv4AddressRanges");
const ipv6Ranges: string[] | undefined = app.node.tryGetContext("allowdIPv6AddressRanges");

const scope: cdk.Stage | cdk.App = stageName ? new cdk.Stage(app, stageName) : app;

// バックエンドを作成する
const backendStack = new BackendStack(scope, 'OmicsBackendStack', {
  ipv4Ranges: ipv4Ranges,
  ipv6Ranges: ipv6Ranges,

  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  env: {
    region: 'us-east-1',
  },

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});

// フロントエンドを作成する
const frontendStack = new FrontendStack(scope, 'OmicsFrontendStack', {
  ipv4Ranges: ipv4Ranges,
  ipv6Ranges: ipv6Ranges,

  cognito: backendStack.cognito,
  apiGateway: backendStack.apiGateway,

  env: {
    region: 'us-east-1',
  },
});

// バックエンドを作成した後にフロントエンドが作成されるように、依存関係を設定する
frontendStack.addDependency(backendStack);
