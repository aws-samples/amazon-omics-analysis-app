<script setup lang="ts">
import { defineComponent, computed, ref } from 'vue';
import PageBase from '../components/common/PageBase.vue';
import BtnReRun from '../components/common/BtnReRun.vue';
import BtnDelete from '../components/common/BtnDelete.vue';
import { useRoute, useRouter } from 'vue-router';
import {
  AnalysisSettings,
  AnalysisTask,
  Analysis,
  ParameterValue,
  Workflow,
  RunVisualization,
  WorkflowVisualizer,
} from 'src/@types/analysis';
import FormSettings from '../components/analysis/FormSettings.vue';
import useAnalysis from 'src/services/useAnalysis';
import _ from 'lodash';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import DisplayBasicInfo from 'src/components/analysis/DisplayBasicInfo.vue';
import TaskTimelineChart from 'src/components/analysis/TaskTimelineChart.vue';
import TableTask from 'src/components/analysis/TableTask.vue';

import VisualizationQuickSightDashboard from 'src/components/analysis/VisualizationQuickSightDashboard.vue';
import VisualizationThreedMol from 'src/components/analysis/Visualization3dMol.vue';

import TreeOutputs from 'src/components/analysis/TreeOutputs.vue';
import CardInfomation from 'src/components/common/CardInfomation.vue';
import InputParameterList from 'src/components/analysis/InputParameterList.vue';

defineComponent({
  components: {
    PageBase,
    BtnReRun,
    BtnDelete,
    FormSettings,
    DisplayBasicInfo,
    TaskTimelineChart,
    TableTask,
  },
  name: 'AnalysisResultPage',
});

const router = useRouter();
const route = useRoute();
const analysis = useAnalysis();
const $q = useQuasar();
const { t } = useI18n();

// PathParamから対象のIDを取得
const id = _.isArray(route.params['id'])
  ? route.params['id'][0]
  : route.params['id'];

const resAnalysis = ref<Analysis>();
const workflow = ref<Workflow | undefined>();
const allRunVisualizations = ref<RunVisualization[]>();
const visualizer = ref<WorkflowVisualizer | undefined>();

const searchRun = async () => {
  try {
    // Analysisの基本情報を取得する際に各操作を行うと不整合が起こる可能性があるので、画面全体をローディング表示にする
    $q.loading.show();
    resAnalysis.value = await analysis.getRun(id);
    const { workflowType, workflowId } = resAnalysis.value;
    workflow.value = await analysis.getWorkflow(workflowType, workflowId);
    allRunVisualizations.value = await analysis.getAllRunVisualizations(id);

    // 実行時に使われたVisualizerを特定する
    // 実行結果自体はvisualizerIdを保持していないため、実行の可視化一覧の
    // visualizationId (「{visualizerId}_{ファイル名}」形式) と
    // ワークフローのVisualizer一覧を突き合わせて逆引きする
    visualizer.value = undefined;
    if (allRunVisualizations.value.length > 0) {
      const allVisualizers = await analysis.getAllWorkflowVisualizers(
        workflowType,
        workflowId
      );
      visualizer.value = allVisualizers.find((v) =>
        allRunVisualizations.value?.some(
          (visualization) =>
            visualization.visualizationId === v.visualizerId ||
            visualization.visualizationId.startsWith(`${v.visualizerId}_`)
        )
      );
    }
  } finally {
    $q.loading.hide();
  }
};

const allDashboards = computed(
  () =>
    allRunVisualizations.value?.filter(
      (visualization) => visualization.type === 'QuickSightDashboard'
    ) ?? []
);

const allThreeDMols = computed(
  () =>
    allRunVisualizations.value?.filter(
      (visualization) => visualization.type === '3Dmol'
    ) ?? []
);

(async () => {
  searchRun();
})();

const loadingTasks = ref(true);
const errorTasks = ref(false);
const allTasks = ref<AnalysisTask[]>([]);

// タスク一覧の検索
const searchTasks = async () => {
  loadingTasks.value = true;
  errorTasks.value = false;
  allTasks.value = [];
  try {
    allTasks.value = await analysis.getAllTasks(id);
  } catch {
    errorTasks.value = true;
  } finally {
    loadingTasks.value = false;
  }
};
(async () => {
  searchTasks();
})();

const settings = computed<AnalysisSettings>(() => {
  return {
    name: resAnalysis.value?.name ?? '',
    storageCapacity: resAnalysis.value?.storageCapacity,
    priority: resAnalysis.value?.priority ?? 0,
    workflowType: resAnalysis.value?.workflowType ?? 'READY2RUN',
    workflow: workflow.value,
    visualizer: visualizer.value,
  };
});

let params = computed<Record<string, ParameterValue>>(() => {
  return resAnalysis.value?.parameters ?? {};
});

const onClickDelete = () => {
  $q.dialog({
    title: t('analysis.info.deleteAnalysis.dialog.title'),
    message: t('analysis.info.deleteAnalysis.dialog.message'),
    cancel: true,
  }).onOk(async () => {
    $q.loading.show({
      message: t('analysis.info.deleteAnalysis.loading.message'),
    });
    try {
      // ワークフロー実行結果を削除する
      await analysis.deleteRun(id);

      // 削除に成功したら一覧画面に戻って、通知を表示する
      await router.push({
        name: 'analysisList',
      });

      $q.notify({
        color: 'positive',
        message: t('analysis.info.deleteAnalysis.notice.success'),
        position: 'top',
      });
    } finally {
      $q.loading.hide();
    }
  });
};

const onClickReRun = () => {
  router.push({
    name: 'rerunAnalysis',
    params: {
      id,
    },
  });
};
</script>

<template>
  <page-base :title="$t('analysis.result.title')">
    <q-card flat bordered class="q-mx-sm">
      <q-card-section>
        <div class="row justify-end q-gutter-sm">
          <btn-delete class="col-auto" @click="onClickDelete" />
          <btn-re-run class="col-auto" @click="onClickReRun" />
        </div>
      </q-card-section>

      <q-card-section class="q-pt-none row q-gutter-sm">
        <!-- 基本情報 -->
        <card-infomation
          class="col-12"
          :title="$t('analysis.info.basic.title')"
          :on-refresh="searchRun"
        >
          <display-basic-info :value="resAnalysis" :readonly="true" />
        </card-infomation>

        <!-- QuickSight ダッシュボード -->
        <card-infomation
          v-for="dashboard in allDashboards"
          class="col-12"
          :key="dashboard.dashboardId"
          :title="$t('analysis.result.dashboard.title')"
        >
          <visualization-quick-sight-dashboard
            :run-id="dashboard.runId"
            :visualization-id="dashboard.visualizationId"
          />
        </card-infomation>

        <!-- 3Dmol -->
        <card-infomation
          v-for="threeDMol in allThreeDMols"
          class="col-12"
          :key="threeDMol.pdbPath"
          :title="threeDMol.pdbPath ?? ''"
        >
          <visualization-threed-mol :run-visualization="threeDMol" />
        </card-infomation>

        <!-- Output一覧 -->
        <card-infomation
          class="col-12"
          :title="$t('analysis.result.outputs.title')"
        >
          <tree-outputs :run-id="id" />
        </card-infomation>

        <!-- ワークフロー設定 -->
        <card-infomation
          class="col-12"
          :title="$t('analysis.info.setting.title')"
        >
          <form-settings :model-value="settings" :readonly="true" />
        </card-infomation>

        <!-- パラメーター -->
        <card-infomation
          class="col-12"
          :title="$t('analysis.info.parameter.title')"
        >
          <q-skeleton v-if="$q.loading.isActive" height="150px" />
          <input-parameter-list
            v-else
            :params="params"
            :parameter-defs="workflow?.parameterTemplate ?? {}"
          />
        </card-infomation>

        <!-- タスク -->
        <card-infomation
          class="col-12"
          :title="$t('analysis.result.task.title')"
          :on-refresh="searchTasks"
        >
          <!-- taskが取得できていない状態で表示するとグラフが描画できないので、taskが取得できてから表示する -->
          <table-task
            :run-id="id"
            :value="allTasks"
            :loading="loadingTasks"
            :error="errorTasks"
          />
          <task-timeline-chart
            v-if="!loadingTasks && !errorTasks && allTasks.length > 0"
            :value="allTasks"
          />
          <q-skeleton v-else height="150px" class="q-mt-md" />
        </card-infomation>
      </q-card-section>
    </q-card>
  </page-base>
</template>
