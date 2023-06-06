import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

/** {@link DynamoDb} コンストラクトのパラメーター */
export interface DynamoDbProps {
}

/**
 * DynamoDB テーブルを構築する CDK コンストラクト
 */
export class DynamoDb extends Construct {
  /** 可視化の結果を保存するための DynamoDB テーブル */
  readonly visualizationsTable: dynamodb.Table;

  /**
   * {@link DynamoDb} コンストラクトを作成する
   * @param scope コンストラクトのスコープ
   * @param id コンストラクトの ID
   * @param props パラメーター
   */
  constructor(scope: Construct, id: string, props: DynamoDbProps) {
    super(scope, id);

    const stageName = cdk.Stage.of(this)?.stageName;

    // ワークフローで利用可能な可視化を管理する Visualizations テーブルを作成する
    this.visualizationsTable = new dynamodb.Table(this, 'VisualizationsTable', {
      tableName: `${stageName ?? ''}OmicsVisualizations`,
      partitionKey: {
        name: 'workflowId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'visualizationId',
        type: dynamodb.AttributeType.STRING,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // CloudFormation スタック削除時に自動削除されるように設定 (実運用ではお勧めしません)
    });
  }
}
