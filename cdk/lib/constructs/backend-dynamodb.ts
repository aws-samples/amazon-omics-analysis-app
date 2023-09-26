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
  readonly workflowVisualizersTable: dynamodb.Table;
  readonly runVisualizationsTable: dynamodb.Table;

  /**
   * {@link DynamoDb} コンストラクトを作成する
   * @param scope コンストラクトのスコープ
   * @param id コンストラクトの ID
   * @param props パラメーター
   */
  constructor(scope: Construct, id: string, props: DynamoDbProps) {
    super(scope, id);

    const stageName = cdk.Stage.of(this)?.stageName;

    // ワークフローで利用可能な可視化を管理する WorkflowVisualizers テーブルを作成する
    this.workflowVisualizersTable = new dynamodb.Table(this, 'WorkflowVisualizersTable', {
      tableName: `${stageName ?? ''}OmicsWorkflowVisualizers`,
      partitionKey: {
        name: 'workflowId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'visualizerId',
        type: dynamodb.AttributeType.STRING,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // CloudFormation スタック削除時に自動削除されるように設定 (実運用ではお勧めしません)
    });

    // ワークフロー実行結果の可視化結果を管理する RunVisualizations テーブルを作成する
    this.runVisualizationsTable = new dynamodb.Table(this, 'RunVisualizationsTable', {
      tableName: `${stageName ?? ''}OmicsRunVisualizations`,
      partitionKey: {
        name: 'runId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'visualizationId',
        type: dynamodb.AttributeType.STRING,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }
}
