# Step Functions ステートマシン定義

![ステートマシン定義](imgs/stepfunctions.png)

このアプリケーションでは、`OmicsWorkflowRunner` という名前の Step Functions ステートマシンで以下のタスクを実行します。

## AWS HealthOmics ワークフローの実行

| Task name                  | Task type | Description |
| -------------------------- | --------- | ----------- |
| CheckOmicsStartRunTask     | Choice    | 入力に `OmicsStartRun` が含まれているかを確認 |
| OmicsStartRunTask          | Lambda    | AWS HealthOmics のワークフローを実行 |
| WaitAfterOmicsStartRunTask | Wait      | AWS HealthOmics のワークフロー完了を数分間待機 |
| OmicsGetRunStatusTask      | Lambda    | AWS HealthOmics のワークフロー実行状態を取得し、`OmicsRun` として出力 |
| CheckOmicsRunFinishedTask  | Choice    | AWS HealthOmics ワークフローが完了したかを確認 |
| CheckOmicsRunFailedTask    | Choice    | AWS HealthOmics ワークフローが失敗したかを確認 |

## 二次解析 (可視化)

| Task name           | Task type      | Description |
| ------------------- | -------------- | ----------- |
| CheckVisualizerTask | Choice         | 入力に `Visualizer` が含まれているかを確認 |
| VisualizationTask   | Step Functions | ワークフロー実行結果の二次解析を実行するため、別の Step Functions ステートマシンを起動 |

## ワークフローの完了通知

| Task name             | Task type | Description |
| --------------------- | --------- | ----------- |
| CheckNotificationTask | Choice    | 入力に `Notification` が含まれているかを確認 |
| NotificationTask      | Lambda    | Amazon SES で完了通知メールを送信 |
