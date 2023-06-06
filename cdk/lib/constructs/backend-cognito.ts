import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as cognito from 'aws-cdk-lib/aws-cognito';

/** {@link Cognito} コンストラクトのパラメーター */
export interface CognitoProps {
}

/**
 * Cognito ユーザープールを構築する CDK コンストラクト
 */
export class Cognito extends Construct {
  /** Cognito ユーザープール */
  readonly userPool: cognito.UserPool;

  /** Cognito ユーザープールのアプリクライアント */
  readonly userPoolClient: cognito.UserPoolClient;

  /**
   * {@link Cognito} コンストラクトを作成する
   * @param scope コンストラクトのスコープ
   * @param id コンストラクトの ID
   * @param props パラメーター
   */
  constructor(scope: Construct, id: string, props: CognitoProps) {
    super(scope, id);

    const stageName = cdk.Stage.of(this)?.stageName;

    // Cognito ユーザープールを作成
    this.userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: `${stageName ?? ''}OmicsUserPool`,
      selfSignUpEnabled: false, // ユーザー自身によるサインアップを無効化
      standardAttributes: {
        email: {
          required: true, // メールアドレスを必須プロパティに設定
          mutable: true, // メールアドレスを変更可に設定（AzureAD連携に必要）
        },
      },
      keepOriginal: {
        email: true,
      },
      mfa: cognito.Mfa.OPTIONAL, // 多要素認証をオプションで利用可能に設定
      signInCaseSensitive: false, // ユーザー名の大文字小文字の違いを無視する設定
      autoVerify: {
        email: true, // コンソールで手動登録したメールアドレスは疎通確認しないように設定
      },
      passwordPolicy: {
        tempPasswordValidity: cdk.Duration.days(7), // コンソールで登録した一時パスワードの有効期間を 7 日に設定
        minLength: 8, // 以下、パスワードの必須要件の設定
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      signInAliases: {
        email: true, // メールアドレスによるサインインを許可する設定
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY, // パスワードリセット方法をメールに限定 (電話番号を使わない)

      removalPolicy: cdk.RemovalPolicy.DESTROY, // CloudFormation スタック削除時に自動削除されるように設定 (実運用ではお勧めしません)
    });

    // Cognito ユーザープールのアプリクライアントを作成
    this.userPoolClient = this.userPool.addClient("UserPoolClient", {
      authSessionValidity: cdk.Duration.minutes(3), // 認証フローセッション持続期間を 3 分に設定
      accessTokenValidity: cdk.Duration.minutes(60), // アクセストークンの有効期限を 60 分に設定
      idTokenValidity: cdk.Duration.minutes(60), // ID トークンの有効期限を 60 分に設定
      refreshTokenValidity: cdk.Duration.days(30), // リフレッシュトークンの有効期限を 30 日に設定
      preventUserExistenceErrors: true, // ID トークンに対応するユーザーが見つからない場合のエラーを、一般的な認証エラーとして返すように設定
      enableTokenRevocation: true, // トークンの無効化ができるように設定
      oAuth: {
        scopes: [
          // このアプリクライアントの OAuth スコープの指定
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
          cognito.OAuthScope.COGNITO_ADMIN,
        ],
        flows: {
          // このアプリクライアントの OAuth フローの指定
          authorizationCodeGrant: true,
        },
      },
    });
  }
}
