#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';

import { OmicsAnalysisAppStack } from '../lib/omics-analysis-app-stack';
import { AlphaFold3DmolVisualizerStack } from '../lib/alphafold-3dmol-visualizer-stack';

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

/** バックエンドへの接続 (CORS)　を許可する Origin */
const additionalAllowOrigins = [
  // ステージが dev の場合のみ、ローカル環境のフロントエンドからの接続を許可する
  // frontend/quasar.config.js の devServer と合わせる
  ...(stageName === 'dev' ? ['http://localhost:9000'] : []),
];

/** Lambda 関数と Lambda レイヤーのアーキテクチャ (`arm64` または `x86_64`) */
let lambdaArchitecture: lambda.Architecture | undefined = undefined;

const lambdaArchitectureName: string | undefined = app.node.tryGetContext('lambdaArchitecture');
if (lambdaArchitectureName !== undefined) {
  lambdaArchitecture = [lambda.Architecture.ARM_64, lambda.Architecture.X86_64].find(
    (architecture) => architecture.name === lambdaArchitectureName,
  );
  if (!lambdaArchitecture) {
    throw new Error(`Invalid context lambdaArchitecture: "${lambdaArchitectureName}". Specify "arm64" or "x86_64".`);
  }
}

const scope: cdk.Stage | cdk.App = stageName ? new cdk.Stage(app, stageName) : app;

// AWS HealthOmics Analysis App を作成する
const omicsAnalysisAppStack = new OmicsAnalysisAppStack(scope, 'OmicsAnalysisAppStack', {
  quickSightIdentityRegion: quickSightIdentityRegion,
  quickSightUserNamespace: quickSightUserNamespace,

  ipv4Ranges: ipv4Ranges,
  ipv6Ranges: ipv6Ranges,

  additionalAllowOrigins: additionalAllowOrigins,

  lambdaArchitecture: lambdaArchitecture,

  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  env: {
    region: 'us-east-1',
  },

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});

// AlphaFold の 3Dmol による可視化を作成する
const alphaFold3DmolVisualizerStack = new AlphaFold3DmolVisualizerStack(scope, 'AlphaFold3DmolVisualizerStack', {
  dynamoDb: omicsAnalysisAppStack.dynamoDb,
  lambdaArchitecture: lambdaArchitecture,

  env: {
    region: 'us-east-1',
  },
});

// OmicsAnalysisAppStack を作成した後に AlphaFold3DmolVisualizerStack が作成されるように、依存関係を設定する
alphaFold3DmolVisualizerStack.addStackDependency(omicsAnalysisAppStack);
