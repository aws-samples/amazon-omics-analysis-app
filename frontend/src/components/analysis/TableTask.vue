<script setup lang="ts">
import { defineComponent, defineProps, computed, ref } from 'vue';
import { AnalysisTask } from 'src/@types/analysis';
import { QTableProps } from 'quasar';
import { useI18n } from 'vue-i18n';
import { formatDatetime, diffTime } from 'src/utils/DateUtils';
import _ from 'lodash';
import TableBase from '../common/TableBase.vue';
import useAnalysis from 'src/services/useAnalysis';
import { useElementSize } from '@vueuse/core';

const { t } = useI18n();
const analysis = useAnalysis();

defineComponent({
  name: 'TableTask',
});

const props = defineProps<{
  runId: string;
  value: AnalysisTask[];
  loading?: boolean;
  error?: boolean;
}>();

const getExecutionTime = (row: AnalysisTask): string => {
  if (row.startTime && row.stopTime) {
    return diffTime(row.startTime, row.stopTime);
  }
  return '';
};

const columns: QTableProps['columns'] = [
  {
    name: 'status',
    field: 'status',
    label: t('analysis.result.task.listTableLabel.status'),
    sortable: true,
  },
  {
    name: 'name',
    field: 'name',
    label: t('analysis.result.task.listTableLabel.name'),
    sortable: true,
  },
  {
    name: 'executionTime',
    field: 'startTime', // データ内に存在しないKeyだとソートが効かないためAnalysisTaskを指定
    label: t('analysis.result.task.listTableLabel.executionTime'),
    format: (val: string, row: AnalysisTask) => {
      if (row.startTime && row.stopTime) {
        return `${diffTime(row.startTime, row.stopTime)}`;
      } else {
        return '';
      }
    },
    sort: (a, b, rowA: AnalysisTask, rowB: AnalysisTask) => {
      return getExecutionTime(rowA) > getExecutionTime(rowB) ? 1 : -1;
    },
    sortable: true,
  },
  {
    name: 'cpus',
    field: 'cpus',
    label: t('analysis.result.task.listTableLabel.vcpu'),
    sortable: true,
  },
  {
    name: 'memory',
    field: 'memory',
    label: t('analysis.result.task.listTableLabel.memory'),
    sortable: true,
  },
  {
    name: 'gpus',
    field: 'gpus',
    label: t('analysis.result.task.listTableLabel.gpu'),
    sortable: true,
  },
  {
    name: 'startTime',
    field: 'startTime',
    label: t('analysis.result.task.listTableLabel.startTime'),
    format: (val: string) => {
      return formatDatetime(val);
    },
    sortable: true,
  },
  {
    name: 'stopTime',
    field: 'stopTime',
    label: t('analysis.result.task.listTableLabel.stopTime'),
    format: (val: string) => {
      return formatDatetime(val);
    },
    sortable: true,
  },
];

const sortedTask = computed(() => _.sortBy(props.value, ['startTime']));

const logMap = ref<{
  [taskId: string]: {
    timestamp: number;
    message: string;
  }[];
}>({});
const loadingLogs = ref<{
  [taskId: string]: boolean;
}>({});
const viewTaskLogs = async (taskId: string) => {
  // ローディグ表示をする
  if (!loadingLogs.value[taskId]) {
    loadingLogs.value[taskId] = true;
  } else if (loadingLogs.value[taskId] === true) {
    // 既に読み込み中の場合は処置を行わない
    return;
  }

  // 一度に取得するログの上限（上限を超える場合は複数回に分けて取得）
  const LIMIT = 1000;
  let forwardToken: string | undefined = undefined;
  logMap.value[taskId] = [];

  try {
    // ログを全て取得できるまでリクエストを繰り返す
    while (true) {
      const res = await analysis.getTaskLog(props.runId, taskId, {
        startFromHead: true,
        nextToken: forwardToken,
        limit: LIMIT,
      });

      // ログを取得できなかった場合は終了
      if (!res.events) {
        break;
      }
      // 取得したログを設定
      logMap.value[taskId].push(...res.events);

      // 以下の場合はログ取得を終了する。それ以外の場合はforwardTokenを設定し後続のログを取得する。
      // ・forwardTokenが同じ場合は全てのログを取得したということなのでログ取得終了
      // 　参考：https://docs.aws.amazon.com/AmazonCloudWatchLogs/latest/APIReference/API_GetLogEvents.html#API_GetLogEvents_ResponseSyntax
      // ・取得件数が検索の上限に満たない場合は全てのログを取得したということなのでログ取得終了
      if (
        forwardToken !== res.nextForwardToken &&
        LIMIT <= (res.events.length ?? 0)
      ) {
        forwardToken = res.nextForwardToken;
      } else {
        break;
      }
    }
  } finally {
    loadingLogs.value[taskId] = false;
  }
};

const table = ref(null);
const { width } = useElementSize(table);
</script>

<template>
  <table-base
    ref="table"
    :rows="sortedTask"
    :columns="columns"
    :loading="loading"
    :error="error"
    expandable
    row-key="taskId"
  >
    <template v-slot:expand-button="{ props }">
      <q-btn
        :disable="
          !['STARTING', 'RUNNING', 'COMPLETED'].includes(props.row.status)
        "
        :color="props.expand ? 'accent' : 'secondary'"
        size="sm"
        :label="
          props.expand ? t('table.btn.hideLogs') : t('table.btn.viewLogs')
        "
        dense
        @click="
          {
            props.expand = !props.expand;
            if (props.expand) {
              viewTaskLogs(props.row.taskId);
            }
          }
        "
      />
    </template>
    <template v-slot:expand-item="{ props }">
      <q-list
        bordered
        class="rounded-borders"
        :style="{
          width: '100%',
          maxWidth: `${width - 30}px`,
          wordBreak: 'break-all',
        }"
      >
        <q-item
          v-if="
            logMap[props.row.taskId] && logMap[props.row.taskId].length === 0
          "
        >
          Loading...
        </q-item>
        <div v-for="(log, idx) in logMap[props.row.taskId]" :key="idx">
          <q-expansion-item
            switch-toggle-side
            :label="log.message"
            label-lines="1"
            :caption="formatDatetime(log.timestamp)"
          >
            <q-card>
              <q-card-section :style="{ wordBreak: 'break-all' }">
                <q-input
                  :model-value="log.message"
                  filled
                  type="textarea"
                  readonly
                  autogrow
                />
              </q-card-section>
            </q-card>
          </q-expansion-item>
          <q-separator />
        </div>
        <q-linear-progress v-if="loadingLogs[props.row.taskId]" indeterminate />
      </q-list>
    </template>
  </table-base>
</template>
