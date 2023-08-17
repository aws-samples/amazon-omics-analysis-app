import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaPython from '@aws-cdk/aws-lambda-python-alpha';
import * as iam from 'aws-cdk-lib/aws-iam';

import * as path from 'path';

/** {@link Cognito} コンストラクトのパラメーター */
export interface CognitoProps {
  /** QuickSight のサインアップを行ったリージョン */
  quickSightIdentityRegion?: string;
  /** QuickSight ユーザーの名前空間 */
  quickSightUserNamespace?: string;
  /** Lambda 関数が共通で利用する Lambda レイヤー */
  commonLayer: lambda.ILayerVersion;
}

/**
 * Cognito ユーザープールを構築する CDK コンストラクト
 */
export class Cognito extends Construct {
  /** Cognito ユーザープール */
  readonly userPool: cognito.UserPool;

  /** Cognito ユーザープールのアプリクライアント */
  readonly userPoolClient: cognito.UserPoolClient;

  /** QuickSight の ID フェデレーション用ロール */
  readonly quickSightFederationRole?: iam.Role;

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
      selfSignUpEnabled: true, // ユーザー自身によるサインアップを有効化
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

    if (props.quickSightIdentityRegion && props.quickSightUserNamespace) {
      this.quickSightFederationRole = new iam.Role(this, 'QuickSightFederationRole', {
        roleName: `${stageName ?? ''}QuickSightFederationRole`,
        assumedBy: new iam.ServicePrincipal('quicksight.amazonaws.com'),
      });

      // Cognito ユーザープールの「確認後トリガー」として登録する Lambda 関数
      const cognitoPostConfirmationTriggerFunction = new lambdaPython.PythonFunction(this, 'PostConfirmationFunction', {
        // エントリポイントとなる index.py が存在するディレクトリの相対パスを指定
        entry: path.join(__dirname, '../../../backend/lambda/functions/Cognito/PostConfirmationTrigger'),
        // 利用するランタイムとして Python 3.9 を指定
        runtime: lambda.Runtime.PYTHON_3_9,
        // 利用するアーキテクチャとして x64_64 を指定
        architecture: lambda.Architecture.X86_64,

        // 利用可能なメモリサイズをデフォルトの 128MB から変更したい場合に指定
        // memorySize: 1024,

        // 利用可能なエフェメラルストレージのサイズをデフォルトの 512MB から変更したい場合に指定
        // ephemeralStorageSize: cdk.Size.gibibytes(1),

        // Lambda 関数が必要とする環境変数の設定
        environment: {
          AWS_ACCOUNT_ID: cdk.Stack.of(this).account,
          QUICKSIGHT_IDENTITY_REGION: props.quickSightIdentityRegion,
          QUICKSIGHT_USER_NAMESPACE: props.quickSightUserNamespace,
          QUICKSIGHT_FEDERATION_ROLE_ARN: this.quickSightFederationRole.roleArn,
        },

        // Lambda 関数が利用するレイヤーの設定
        layers: [props.commonLayer],

        // 実行タイムアウトを 30 秒に設定
        timeout: cdk.Duration.seconds(30),
        // AWS X-Ray による Lambda 関数の実行トレースを有効にする
        tracing: lambda.Tracing.ACTIVE
      });

      // QuickSight のユーザーを作成し、グループに所属させる権限を付与
      const quickSightPolicyStatement = new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['quicksight:RegisterUser'],
        resources: [
          cdk.Stack.of(this).formatArn({
            service: 'quicksight',
            region: props.quickSightIdentityRegion,
            resource: 'user',
            resourceName: `${props.quickSightUserNamespace}/${this.quickSightFederationRole.roleName}/*`,
          }),
        ],
      });
      cognitoPostConfirmationTriggerFunction.addToRolePolicy(quickSightPolicyStatement);

      // Cognito ユーザープールの「確認後トリガー」として登録
      this.userPool.addTrigger(cognito.UserPoolOperation.POST_CONFIRMATION, cognitoPostConfirmationTriggerFunction)

      // Cognito ユーザープールの「認証後トリガー」として登録する Lambda 関数
      const cognitoPostAuthenticationTriggerFunction = new lambdaPython.PythonFunction(this, 'PostAuthenticationFunction', {
        entry: path.join(__dirname, '../../../backend/lambda/functions/Cognito/PostAuthenticationTrigger'),
        runtime: lambda.Runtime.PYTHON_3_9,
        architecture: lambda.Architecture.X86_64,

        environment: {
          AWS_ACCOUNT_ID: cdk.Stack.of(this).account,
          QUICKSIGHT_IDENTITY_REGION: props.quickSightIdentityRegion,
          QUICKSIGHT_USER_NAMESPACE: props.quickSightUserNamespace,
          QUICKSIGHT_FEDERATION_ROLE_ARN: this.quickSightFederationRole.roleArn,
        },
        layers: [props.commonLayer],

        timeout: cdk.Duration.seconds(30),
        tracing: lambda.Tracing.ACTIVE
      });
      cognitoPostAuthenticationTriggerFunction.addToRolePolicy(quickSightPolicyStatement);

      // Cognito ユーザープールの「認証後トリガー」として登録
      this.userPool.addTrigger(cognito.UserPoolOperation.POST_AUTHENTICATION, cognitoPostAuthenticationTriggerFunction)
    }
  }
}
