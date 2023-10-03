#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';

import { OmicsAnalysisAppStack } from '../lib/omics-analysis-app-stack';

const app = new cdk.App();

// cdk.json から各種設定を読み込む
const stageName: string | undefined = app.node.tryGetContext('stage');

/** QuickSight のサインアップを行ったリージョン */
const quickSightIdentityRegion: string | undefined = app.node.tryGetContext('quickSightIdentityRegion') ?? 'us-east-1';

/** QuickSight ユーザーの名前空間 */
const quickSightUserNamespace: string | undefined = app.node.tryGetContext('quickSightUserNamespace') ?? 'default';

// プロトタイプへの接続を許可するアクセス元 IP アドレスの CIDR 一覧
const ipv4Ranges: string[] | undefined = app.node.tryGetContext("allowdIPv4AddressRanges");
const ipv6Ranges: string[] | undefined = app.node.tryGetContext("allowdIPv6AddressRanges");

const scope: cdk.Stage | cdk.App = stageName ? new cdk.Stage(app, stageName) : app;

// AWS HealthOmics Analysis App を作成する
const omicsAnalysisAppStack = new OmicsAnalysisAppStack(scope, 'OmicsAnalysisAppStack', {
  quickSightIdentityRegion: quickSightIdentityRegion,
  quickSightUserNamespace: quickSightUserNamespace,

  ipv4Ranges: ipv4Ranges,
  ipv6Ranges: ipv6Ranges,

  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  env: {
    region: 'us-east-1',
  },

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});
