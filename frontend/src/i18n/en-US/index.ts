// NOTE: @intlify/unplugin-vue-i18n のプリコンパイルは静的な
// `export default {...}` のみサポートするため、変数参照は使わないこと
export default {
  appName: 'AWS HealthOmics Analysis App',
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
          name: 'Name',
          status: 'Status',
          arn: 'ARN',
          creationTime: 'Creation Time',
          startTime: 'Start Time',
          stopTime: 'Stop Time',
        },
      },
      setting: {
        title: 'Settings',
        params: {
          name: 'Analysis Name',
          storageCapacity: 'Storage Capacity',
          priority: 'Priority',
          roleArn: 'IAM Role ARN',
          logLevel: 'Log Level',
          workflowType: 'Workflow Type',
          workflow: 'Workflow',
          visualizer: 'Visualizer',
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
        status: 'Status',
        name: 'Name',
        executionTime: 'Execution Time',
        creationTime: 'Creation Time',
        startTime: 'Start Time',
        stopTime: 'Stop Time',
      },
    },
    result: {
      title: 'Analysis Results',
      task: {
        title: 'Tasks',
        listTableLabel: {
          status: 'Status',
          name: 'Task Name',
          executionTime: 'Execution Time',
          vcpu: 'vCPU',
          memory: 'Memory(GiB)',
          gpu: 'GPU',
          startTime: 'Start Time',
          stopTime: 'Stop Time',
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
