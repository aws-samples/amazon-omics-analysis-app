import os
import boto3
import cfnresponse

DYNAMODB_TABLE_NAME_WORKFLOW_VISUALIZERS = os.environ['DYNAMODB_TABLE_NAME_WORKFLOW_VISUALIZERS']
dynamodb = boto3.client('dynamodb')


def handler(event, context):
    request_type = event['RequestType']
    logical_resource_id = event.get('LogicalResourceId')
    physical_resource_id = event.get('PhysicalResourceId')

    resource_properties = event['ResourceProperties']
    workflow_type = resource_properties['WorkflowType']
    workflow_id = resource_properties['WorkflowId']
    physical_workflow_id = f'{workflow_type}_{workflow_id}'

    visualizer_id = resource_properties['VisualizerId']
    physical_visualizer_id = f'{logical_resource_id}_{visualizer_id}'

    name = resource_properties.get('Name') or visualizer_id
    state_machine_arn = resource_properties['StateMachineArn']

    try:
        if request_type == 'Create':
            dynamodb.put_item(
                TableName=DYNAMODB_TABLE_NAME_WORKFLOW_VISUALIZERS,
                Item={
                    'workflowId': {
                        'S': physical_workflow_id,
                    },
                    'visualizerId': {
                        'S': physical_visualizer_id,
                    },
                    'name': {
                        'S': name,
                    },
                    'stateMachineArn': {
                        'S': state_machine_arn,
                    },
                },
                ConditionExpression='attribute_not_exists(workflowId) AND attribute_not_exists(visualizerId)',
            )
            physical_resource_id = f'{physical_workflow_id}-{physical_visualizer_id}'
            cfnresponse.send(event, context, cfnresponse.SUCCESS, resource_properties, physical_resource_id)

        elif request_type == 'Update':
            dynamodb.update_item(
                TableName=DYNAMODB_TABLE_NAME_WORKFLOW_VISUALIZERS,
                Key={
                    'workflowId': {
                        'S': physical_workflow_id,
                    },
                    'visualizerId': {
                        'S': physical_visualizer_id,
                    },
                },
                UpdateExpression='SET #nm = :nm, #sm = :sm',
                ExpressionAttributeNames={
                    '#nm': 'name',
                    '#sm': 'stateMachineArn'
                },
                ExpressionAttributeValues={
                    ':nm': {
                        'S': name,
                    },
                    ':sm': {
                        'S': state_machine_arn,
                    },
                },
            )
            cfnresponse.send(event, context, cfnresponse.SUCCESS, resource_properties, physical_resource_id)

        elif request_type == 'Delete':
            dynamodb.delete_item(
                TableName=DYNAMODB_TABLE_NAME_WORKFLOW_VISUALIZERS,
                Key={
                    'workflowId': {
                        'S': physical_workflow_id,
                    },
                    'visualizerId': {
                        'S': physical_visualizer_id,
                    },
                },
            )
            cfnresponse.send(event, context, cfnresponse.SUCCESS, None, physical_resource_id)

    except Exception as err:
        print(err)
        cfnresponse.send(event, context, cfnresponse.FAILED, None, physical_resource_id)
