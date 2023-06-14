export type SetInitValueOption = {
  shouldSet: boolean;
  force?: boolean;
};

export type WorkflowType = 'READY2RUN' | 'PRIVATE';

export type AnalysisSettings = {
  name: string;
  storageCapacity?: number;
  priority: number;
  workflowType: WorkflowType;
  workflow?: Workflow;
  visualization?: Visualization;
};

export type Workflow = {
  id: string;
  arn: string;
  name: string;
  description: string;
  type: WorkflowType;
  parameterTemplate: {
    [key: string]: WorkflowParameterDefinition;
  };
};

export type WorkflowParameterDefinition = {
  description: string;
  optional: boolean;
};

export type ParameterValue = string | number | boolean | null;

export type Analysis = {
  status: string;
  statusMessage: string;
  id: string;
  arn: string;
  creationTime: string;
  name: string;
  priority: number;
  startTime: string;
  stopTime: string;
  storageCapacity?: number;
  accelerators?: string;
  logLevel: string;
  outputUri: string;
  parameters: { [key: string]: ParameterValue };
  roleArn: string;
  runId: string;
  workflowType: WorkflowType;
  workflowId: string;
};

export type ParameterDescription = {
  paramType?: string;
  options?: string;
  initialValue?: string;
  caption?: string;
  category?: number;
  item?: number;
};

export type AnalysisTask = {
  name: string;
  status: string;
  statusMessage: string;
  cpus: number;
  memory: number;
  gpus?: number;
  creationTime: string;
  startTime?: string;
  stopTime?: string;
  taskId: string;
  logStream: string;
};

export type StartAnalysisParams = {
  name: string;
  parameters?: { [key: string]: ParameterValue };
  priority?: number;
  requestId?: string;
  runId?: string;
  storageCapacity?: number;
  workflowType?: WorkflowType;
  workflowId?: string;
  visualizationId?: string;
};

export type OutputItem = {
  path: string;
  size?: number;
};

export type Visualization = {
  workflowId: string;
  visualizationId: string;
  name: string;
  stateMachineArn: string;
};

export type Dashboard = {
  runId: string;
  visualizationId: string;
  dashboardId: string;
};
