const analysisItem = {
  name: 'Name',
  creationTime: 'Creation Time',
  startTime: 'Start Time',
  stopTime: 'Stop Time',
  executionTime: 'Execution Time',
  status: 'Status',
  arn: 'Omics ARN',
  priority: 'Priority',
  storageCapacity: 'Storage Capacity',
};

export default {
  appName: 'Amazon Omics Analysis App',
  signout: 'SignOut',
  btn: {
    newAnalysis: 'New Analysis',
    run: 'Run',
    reRun: 'ReRun',
    delete: 'Delete',
    add: 'Add',
  },
  table: {
    networkError: 'An error occurred in the network.',
    btn: {
      viewLogs: 'View Logs',
      hideLogs: 'Hide Logs',
    },
  },
  menu: {
    analsysList: 'Analysis List',
    newAnalysis: 'New Analysis',
  },
  workflow: {
    type: {
      ready2run: 'Ready2Run',
      private: 'Private',
    },
  },
  analysis: {
    // Analysisの詳細情報
    info: {
      basic: {
        title: 'Info',
        params: {
          name: analysisItem.name,
          status: analysisItem.status,
          arn: analysisItem.arn,
          creationTime: analysisItem.creationTime,
          startTime: analysisItem.startTime,
          stopTime: analysisItem.stopTime,
        },
      },
      setting: {
        title: 'Settings',
        params: {
          name: 'Analysis Name',
          storageCapacity: analysisItem.storageCapacity,
          priority: analysisItem.priority,
          roleArn: 'IAM Role ARN',
          logLevel: 'Log Level',
          workflowType: 'Workflow Type',
          workflow: 'Workflow',
          visualization: 'Visualization',
          s3output: 'S3 Output URI',
        },
      },
      parameter: {
        title: 'Parameters',
        params: {
          key: 'Key',
          value: 'Value',
          required: 'REQUIRED',
          advanced: 'ADVANCED',
          true: 'Yes',
          false: 'No',
          notSpecified: '[Not Specified]',
          showAllAdvancedParam: 'Show all advanced Parameters',
          showAdvancedParam: 'Show advanced Parameters',
          hideAdvancedParam: 'Hide advanced Parameters',
          showAdvancedCategory: 'Show advanced categories',
          hideAdvancedCategory: 'Hide advanced categories',
        },
      },
      deleteAnalysis: {
        dialog: {
          title: 'Confirmation',
          message: 'Do you want to delete analysis?',
        },
        loading: {
          message: 'Deleting analysis...',
        },
        notice: {
          success: 'Analysis deleted.',
        },
      },
    },
    // 実行画面
    run: {
      title: 'New Analysis',
      setting: {
        basic: {
          title: 'Settings',
        },
        parameter: {
          title: 'Parameters',
        },
        confirmation: {
          title: 'Confirmation',
        },
        btn: {
          continue: 'Continue',
          back: 'Back',
        },
      },
      dialog: {
        runConfirmation: {
          title: 'Confirmation',
          message: 'Do you want to run analysis?',
        },
      },
      loading: {
        message: 'Analysis will be running. Please wait...',
      },
      notice: {
        success: 'Analysis is running.',
      },
      error: {
        validationErrorMessage: 'Validation Error. Please check the parameters',
      },
    },
    // 一覧画面
    list: {
      title: 'Analysis List',
      listTableLabel: {
        status: analysisItem.status,
        name: analysisItem.name,
        executionTime: analysisItem.executionTime,
        creationTime: analysisItem.creationTime,
        startTime: analysisItem.startTime,
        stopTime: analysisItem.stopTime,
      },
    },
    result: {
      title: 'Analysis Results',
      task: {
        title: 'Tasks',
        listTableLabel: {
          status: analysisItem.status,
          name: 'Task Name',
          executionTime: analysisItem.executionTime,
          vcpu: 'vCPU',
          memory: 'Memory(GiB)',
          gpu: 'GPU',
          startTime: analysisItem.startTime,
          stopTime: analysisItem.stopTime,
        },
      },
      dashboard: {
        title: 'Dashboard',
        notFoundError: 'Dashboard not generated.',
        otherError: 'An error occurred while embedding the dashboard.',
      },
      outputs: {
        title: 'Outputs',
        download: 'Download',
        notFoundError: 'Outputs not created.',
      },
    },
  },
};
