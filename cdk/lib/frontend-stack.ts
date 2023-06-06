import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { NodejsBuild } from 'deploy-time-build';
import * as path from 'path';

import { CloudFront } from './constructs/frontend-cloudfront';
import { Waf } from './constructs/waf';
import { Cognito } from './constructs/backend-cognito';
import { ApiGateway } from './constructs/backend-apigateway';

/** {@link FrontendStack} のパラメーター */
export interface FrontendStackProps extends cdk.StackProps {
  /** フロントエンドへの接続を許可する IP アドレスの CIDR */
  ipv4Ranges?: string[];
  ipv6Ranges?: string[];

  cognito: Cognito;
  apiGateway: ApiGateway;
}

/** フロントエンドを構築する CDK スタック */
export class FrontendStack extends cdk.Stack {
  /**
   * {@link FrontendStack} をデプロイする
   * @param scope スタックのスコープ
   * @param id スタックの ID
   * @param props パラメーター
   */
  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    // フロントエンドへのアクセスを制限する Web ACLを作成
    let waf: Waf | undefined = undefined;
    if (props.ipv4Ranges || props.ipv6Ranges) {
      waf = new Waf(this, 'Waf', {
        ipv4Ranges: props.ipv4Ranges,
        ipv6Ranges: props.ipv6Ranges,
        scope: 'CLOUDFRONT',
      });
    }

    // フロントエンドのアセットを配信する CloudFront を作成
    const cloudfront = new CloudFront(this, 'CloudFront', {
      webAclId: waf?.webAcl?.attrArn,
    });

    // フロントエンドの URL を CloudFormation スタックの出力に追加
    new cdk.CfnOutput(this, 'FrontendURL', {
      value: 'https://' + cloudfront.distribution.domainName,
    });

    // フロントエンドのアセットを格納する S3 バケット名を CloudFormation スタックの出力に追加
    new cdk.CfnOutput(this, 'FrontendBucket', {
      value: cloudfront.assetBucket.s3UrlForObject(),
    });

    // CloudFront へのアクセスログを格納する S3 バケット名を CloudFormation スタックの出力に追加
    new cdk.CfnOutput(this, 'FrontendAccessLogBucket', {
      value: cloudfront.accessLogBucket.s3UrlForObject(),
    });

    // フロントエンドのアセットをビルドし、S3 バケットにアップロードする
    new NodejsBuild(this, 'NodejsBuild', {
      assets: [
        // フロントエンドのソースコードの場所を指定
        {
          path: path.join(__dirname, '../../frontend'),
          exclude: [
            'dist',
            'node_modules'
          ],
        },
      ],
      outputSourceDirectory: 'dist/spa',

      // ビルド時の環境変数に各種設定を反映する
      buildEnvironment: {
        // バックエンド API の URL
        VITE_API_URL: props.apiGateway.restApi.url,
        // Cognito ユーザープールがデプロイされたリージョン
        VITE_AUTH_REGION: props.cognito.userPool.env.region,
        // Cognito ユーザープール ID
        VITE_AUTH_USER_POOL_ID: props.cognito.userPool.userPoolId,
        // Cognito ユーザープールクライアントの ID
        VITE_AUTH_WEB_CLIENT_ID: props.cognito.userPoolClient.userPoolClientId,
      },

      // ビルドを実行する Node.js のバージョンを指定
      nodejsVersion: 18,

      // ビルドを実行するためのコマンド
      buildCommands: [
        'npm ci',
        'npm run build'
      ],

      // アップロード先の S3 バケット
      destinationBucket: cloudfront.assetBucket,

      // アップロード完了後、新しいアセットを即時反映するために CloudFront のキャッシュを消すための設定
      // 参考: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_s3_deployment.BucketDeployment.html
      distribution: cloudfront.distribution,
    });
  }
}
