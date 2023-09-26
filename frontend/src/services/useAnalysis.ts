import { AxiosError } from 'axios';
import {
  Analysis,
  AnalysisTask,
  StartAnalysisParams,
  WorkflowType,
  Workflow,
  WorkflowVisualizer,
  RunVisualization,
} from 'src/@types/analysis';
import { api, apiWithoutErrorHandling } from 'src/boot/axios';

export type GetRunsResponse = {
  items: Analysis[];
  nextToken?: string;
};

export type GetTasksResponse = {
  items?: AnalysisTask[];
  nextToken?: string;
};

export type GetTaskLogOption = {
  /** ログの取得順序 true:古いログから取得 false:新しいログから取得 */
  startFromHead?: boolean;
  /** 一度に取得するログ件数の上限 */
  limit?: number;
  /** 継続取得用のトークン */
  nextToken?: string;
  /** センシティブな情報をマスクするかどうか true:マスクしない false:マスクする */
  unmask?: boolean;
};

export type GetTaskLogResponse = {
  events: {
    timestamp: number;
    message: string;
    ingestion: number;
  }[];
  nextBackwardToken: string;
  nextForwardToken: string;
};

export type GetRunOutputsOption = {
  /** 一覧取得の動作 flat:全てのファイル一覧を返す hierarchical:ルート直下のファイルとフォルダ一覧を返す */
  mode?: 'flat' | 'hierarchical';
  /** レスポンスのファイル上限 */
  maxKeys?: number;
  /** 継続取得用のトークン */
  continuationToken?: string;
};

export type GetRunOutputsResponse = {
  contents: {
    path: string;
    size: number;
  }[];
  folders: {
    path: string;
  }[];
  NextContinuationToken?: string;
};

export type StartRunResponse = {
  arn: string;
  id: string;
  status: string;
  tags: { [key: string]: string };
};

export type GetWorkflowsResponse = {
  items: Workflow[];
  nextToken?: string;
};

export type GetWorkflowVisualizersResponse = {
  items: WorkflowVisualizer[];
  nextToken?: string;
};

export type GetRunVisualizationsResponse = {
  items: RunVisualization[];
  nextToken?: string;
};

const useAnalysis = () => {
  return {
    /**
     * ワークフローの実行一覧を取得
     * @param startingToken ページング処理用トークン
     * @returns 実行一覧
     */
    getRuns: async (startingToken?: string) => {
      const response = await api.get<GetRunsResponse>('/runs', {
        params: {
          ...(startingToken && { startingToken: startingToken }),
        },
      });
      return response.data;
    },

    /**
     * ワークフロー実行の詳細情報を取得
     * @param id 実行 ID
     * @returns 実行の詳細情報
     */
    getRun: async (id: string) => {
      const response = await api.get<Analysis>(`/runs/${id}`);
      return response.data;
    },

    /**
     * 指定された実行のタスク一覧を取得
     * @param runId 実行 ID
     * @param startingToken ページング処理用トークン
     * @returns タスク一覧
     */
    getTasks: async (runId: string, startingToken?: string) => {
      const response = await api.get<GetTasksResponse>(`/runs/${runId}/tasks`, {
        params: {
          ...(startingToken && { startingToken: startingToken }),
        },
      });
      return response.data;
    },

    /**
     * 指定されたタスクの実行ログを取得
     * @param runId 実行 ID
     * @param taskId タスク ID
     * @param option オプション
     * @returns 実行ログ
     */
    getTaskLog: async (runId: string, taskId: string, option: GetTaskLogOption = {
      startFromHead: true,
      limit: 10000,
      unmask: false,
    }) => {
      const response = await api.get<GetTaskLogResponse>(`/runs/${runId}/tasks/${taskId}/log`, {
        params: {
          ...option,
        },
      });
      return response.data;
    },

    /**
     * ワークフロー実行結果の出力ファイル一覧を取得
     * @param runId 実行 ID
     * @param path ファイルパス
     * @param option オプション
     * @returns 出力ファイル一覧
     */
    getOutputs: async (runId: string, path: string, option: GetRunOutputsOption = {
      mode: 'flat',
      maxKeys: 1000,
    }): Promise<GetRunOutputsResponse | undefined> => {
      try {
        const response = await apiWithoutErrorHandling.get<GetRunOutputsResponse>(`/runs/${runId}/outputs/${path}`, {
          params: {
            ...option,
          },
        });
        return response.data;
      } catch(err) {
        // 404エラーの場合はエラー処理しない
        if (err instanceof AxiosError && err.response?.status === 404) {
          return undefined;
        }
        throw err;
      }
    },

    /**
     * ワークフロー実行結果の出力ファイルをダウンロードするための URL を取得
     * @param runId 実行 ID
     * @param path ファイルパス
     * @param attachemant ブラウザにダウンロード動作を強制する
     * @returns URL
     */
    getOutputUrl: async (runId: string, path: string, attachemant = false) => {
      const response = await api.get<string>(`/runs/${runId}/outputs/${path}`, {
        params: { attachment: attachemant },
      });
      return response.data;
    },

    /**
     * ワークフローの実行結果を削除
     * @param id 実行 ID
     */
    deleteRun: async(runId: string) => {
      await api.delete<void>(`/runs/${runId}`);
    },

    /**
     * ワークフローを新規実行する
     * @param params パラメーター
     * @returns 新規実行結果
     */
    startAnalysis: async (params: StartAnalysisParams) => {
      const response = await api.post<StartRunResponse>('/analyses', params);
      return response.data;
    },

    /**
     * ワークフロー一覧を取得
     * @param workflowType ワークフロー種別
     * @param startingToken ページング処理用トークン
     * @returns ワークフロー一覧
     */
    getWorkflows: async (workflowType: WorkflowType, startingToken?: string) => {
      const response = await api.get<GetWorkflowsResponse>(`/workflows/${workflowType}`, {
        params: {
          ...(startingToken && { startingToken: startingToken }),
        },
      });
      return response.data;
    },

    /**
     * ワークフローの詳細情報を取得
     * @param workflowType ワークフロー種別
     * @param workflowId ワークフローID
     * @returns ワークフローの詳細情報
     */
    getWorkflow: async (workflowType: WorkflowType, workflowId: string): Promise<Workflow | undefined> => {
      try {
        const response = await apiWithoutErrorHandling.get<Workflow>(`/workflows/${workflowType}/${workflowId}`);
        return response.data;
      } catch(err) {
        // 404エラーの場合はエラー処理しない
        if (err instanceof AxiosError && err.response?.status === 404) {
          return undefined;
        }
        throw err;
      }
    },

    /**
     * ワークフローで実行可能な可視化一覧を取得
     * @param workflowType ワークフロー種別
     * @param workflowId ワークフローID
     * @param startingToken ページング処理用トークン
     * @returns ワークフローの可視化一覧
     */
    getWorkflowVisualizers: async (workflowType: WorkflowType, workflowId: string, startingToken?: string) => {
      const response = await api.get<GetWorkflowVisualizersResponse>(`/workflows/${workflowType}/${workflowId}/visualizers`, {
        params: {
          ...(startingToken && { startingToken: startingToken }),
        },
      });
      return response.data;
    },

    /**
     * 可視化の詳細情報を取得
     * @param workflowType ワークフロー種別
     * @param workflowId ワークフローID
     * @param visualizerId 可視化ID
     * @returns ワークフローの可視化の詳細情報
     */
    getWorkflowVisualizer: async (workflowType: WorkflowType, workflowId: string, visualizerId: string) => {
      const response = await api.get<WorkflowVisualizer>(`/workflows/${workflowType}/${workflowId}/visualizers/${visualizerId}`);
      return response.data;
    },

    /**
     * 指定された実行の可視化一覧の取得
     * @param runId 実行 ID
     * @param startingToken ページング処理用トークン
     * @returns 実行の可視化一覧
     */
    getRunVisualizations: async (runId: string, startingToken?: string) => {
      const response = await api.get<GetRunVisualizationsResponse>(`/runs/${runId}/visualizations`, {
        params: {
          ...(startingToken && { startingToken: startingToken }),
        },
      });
      return response.data;
    },

    /**
     * 指定された実行の QuickSight ダッシュボード埋め込み用 URL の取得
     * @param runId 実行 ID
     * @param visualizationId 可視化 ID
     * @returns ダッシュボード埋め込み用 URL
     */
    getDashboardUrl: async (runId: string, visualizationId: string) => {
      const response = await api.get<string>(`/runs/${runId}/visualizations/${visualizationId}/dashboard`);
      return response.data;
    },
  };
};

export default useAnalysis;
