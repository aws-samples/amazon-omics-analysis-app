# Step Functions state machine definition

![State machine definition](imgs/stepfunctions.png)

In this application, Step Functions state machine named `OmicsWorkflowRunner` performs the following tasks.

## Run Amazon Omics workflow

| Task name                  | Task type | Description |
| -------------------------- | --------- | ----------- |
| CheckOmicsStartRunTask     | Choice    | Is `OmicsStartRun` present in the input? |
| OmicsStartRunTask          | Lambda    | Start Omics workflow run. |
| WaitAfterOmicsStartRunTask | Wait      | Wait for a few minutes for Omics workflow run to complete. |
| OmicsGetRunStatusTask      | Lambda    | Get Omics run status as `OmicsRun` output. |
| CheckOmicsRunFinishedTask  | Choice    | Is Omics workflow run finished? |
| CheckOmicsRunFailedTask    | Choice    | Is Omics workflow run failed? |

## Secondary analysis (visualization)

| Task name              | Task type      | Description |
| ---------------------- | -------------- | ----------- |
| CheckVisualizationTask | Choice         | Is `Visualization` present in the input? |
| VisualizationTask      | Step Functions | Start secondary analysis of workflow run outputs with nested Step Functions state machine. |

## Notify workflow completion

| Task name             | Task type | Description |
| --------------------- | --------- | ----------- |
| CheckNotificationTask | Choice    | Is `Notification` present in the input? |
| NotificationTask      | Lambda    | Send notification email with Amazon SES. |
