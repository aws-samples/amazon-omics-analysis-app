import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';

/** {@link CloudFront} コンストラクトのパラメーター */
export interface CloudFrontProps {
  /** フロントエンドに接続できる IP アドレスを制限するための WebACL の ID */
  webAclId?: string;
}

/**
 * フロントエンドのアセットを配信する CloudFront ディストリビューションを構築する CDK コンストラクト
 */
export class CloudFront extends Construct {
  /** フロントエンドのアセットを格納する S3 バケット */
  readonly assetBucket: s3.Bucket;

  /** フロントエンドのアクセスログを格納する S3 バケット */
  readonly accessLogBucket: s3.Bucket;

  /** フロントエンドのアセットを配信する CloudFront ディストリビューション */
  readonly distribution: cloudfront.Distribution;

  /** フロントエンドの URL */
  readonly url: string

  /**
   * {@link FrontendCloudFront} コンストラクトを作成する
   * @param scope コンストラクトのスコープ
   * @param id コンストラクトの ID
   * @param props パラメーター
   */
  constructor(scope: Construct, id: string, props: CloudFrontProps) {
    super(scope, id);

    // フロントエンドのアセットを格納するためのバケットを作成する
    this.assetBucket = new s3.Bucket(this, 'AssetBucket', {
      // CDK でデプロイしたものを削除する際、バケットも連動して削除する設定
      // (意図せず削除してしまう可能性があるため、本番環境で DESTROY を使用するのはお勧めしません)
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,

      // バケットへのパブリックアクセスを全てブロックする
      // https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,

      // Amazon S3 マネージド キーを使ったバケットの暗号化を有効化する
      // https://docs.aws.amazon.com/AmazonS3/latest/userguide/default-bucket-encryption.html
      encryption: s3.BucketEncryption.S3_MANAGED,

      // バケットへのアクセスに SSL を必須にする
      enforceSSL: true,
    });

    // S3 バケット内にファイルが存在しないパスに CloudFront からアクセスがあった場合、404 Not Found エラーとなるようにバケットポリシーを設定する
    // (この設定を行わなかった場合は 403 Forbidden エラーとなり、アクセス権がない場合と区別がつきません)
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OriginAccesIdentity')
    this.assetBucket.addToResourcePolicy(new iam.PolicyStatement({
      actions: ['s3:ListBucket'],
      resources: [this.assetBucket.bucketArn],
      principals: [originAccessIdentity.grantPrincipal],
    }));

    // CloudFront へのアクセスログを格納するためのバケットを作成する
    this.accessLogBucket = new s3.Bucket(this, 'AccessLogBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,

      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,

      // バケットにファイルをアップロードしたアカウントを、そのファイルの所有者として ACL の設定を許可する
      // https://docs.aws.amazon.com/AmazonS3/latest/userguide/about-object-ownership.html
      objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,

      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
    });

    // CloudFront ディストリビューションを作成
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      httpVersion: cloudfront.HttpVersion.HTTP2,

      defaultBehavior: {
        // 配信元の S3 バケットを指定
        origin: new origins.S3Origin(this.assetBucket, {
          originAccessIdentity: originAccessIdentity,
        }),
        // HTTP によるアクセスは HTTPS にリダイレクトする
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },

      // フロントエンドのルートコンテンツを指定
      defaultRootObject: 'index.html',

      // SPA が動作するようにするため、404 Not Found エラーの場合はルートにリダイレクトする
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/',
        },
      ],

      // アクセスログを有効にする
      enableLogging: true,
      logBucket: this.accessLogBucket,

      // フロントエンドへのアクセスを日本の IP アドレスからのみに制限する (プロトタイプ用の設定)
      geoRestriction: cloudfront.GeoRestriction.allowlist('JP'),

      // フロントエンドに接続できる IP アドレスを制限するため、WAF の WebACL ID を指定
      ...props.webAclId && { webAclId: props.webAclId },
    });
    this.url = 'https://' + this.distribution.domainName;
  }
}
