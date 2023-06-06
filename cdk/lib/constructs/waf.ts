import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";

/** {@link Waf} コンストラクトのパラメーター */
export interface WafProps {
  /** 接続を許可する IP アドレスの CIDR */
  ipv4Ranges?: string[];
  ipv6Ranges?: string[];

  /** WAF の対象スコープ (`CLOUDFRONT` or `REGIONAL`) */
  scope: string;
}

/**
 * IP アドレス制限を設定する WAF を構築する CDK コンストラクト
 */
export class Waf extends Construct {
  readonly webAcl: wafv2.CfnWebACL;

  /**
   * {@link Waf} コンストラクトを作成する
   * @param scope コンストラクトのスコープ
   * @param id コンストラクトの ID
   * @param props パラメーター
   */
  constructor(scope: Construct, id: string, props: WafProps) {
    super(scope, id);

    // IP アドレス制限の定義を作成
    let statements: Array<wafv2.CfnWebACL.StatementProperty | cdk.IResolvable> = [];
    if (props.ipv4Ranges) {
      const ipSetV4ReferenceStatement = new wafv2.CfnIPSet(this, "IpSetV4", {
        ipAddressVersion: "IPV4",
        scope: props.scope,
        addresses: props.ipv4Ranges,
      });
      statements.push({ ipSetReferenceStatement: { arn: ipSetV4ReferenceStatement.attrArn } });
    }
    if (props.ipv6Ranges) {
      const ipSetV6ReferenceStatement = new wafv2.CfnIPSet(this, "IpSetV6", {
        ipAddressVersion: "IPV6",
        scope: props.scope,
        addresses: props.ipv6Ranges,
      });
      statements.push({ ipSetReferenceStatement: { arn: ipSetV6ReferenceStatement.attrArn } });
    }

    // アクセスを制限する Web ACLを作成
    this.webAcl = new wafv2.CfnWebACL(this, "WebAcl", {
      defaultAction: { block: {} }, // デフォルトはアクセス拒否
      scope: props.scope,
      visibilityConfig: {
        cloudWatchMetricsEnabled: true, // CloudWatch によるアクセス拒否の集計を有効にする
        metricName: "Block",
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          priority: 0,
          name: "IpRuleSet",
          action: { allow: {} }, // IP アドレスによるアクセス許可を設定する
          visibilityConfig: {
            cloudWatchMetricsEnabled: true, // CloudWatch によるアクセス許可の集計を有効にする
            metricName: "Allow",
            sampledRequestsEnabled: true,
          },
          statement: {
            orStatement: {
              statements: statements, // IPv4 または IPv6 アドレスが指定範囲に該当すればアクセスを許可する
            },
          },
        },
      ],
    });
  }
}
