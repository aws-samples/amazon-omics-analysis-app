<script setup lang="ts">
import { QTableProps } from 'quasar';
import { Analysis } from 'src/@types/analysis';
import { defineComponent, defineProps } from 'vue';
import { useI18n } from 'vue-i18n';
import { diffTime, formatDatetime } from 'src/utils/DateUtils';
import TableBase from '../common/TableBase.vue';

const { t } = useI18n();

defineComponent({
  name: 'TableAnalysisList',
});

defineProps<{
  rows: Analysis[] | undefined;
  loading?: boolean;
  error?: boolean;
}>();

const getExecutionTime = (row: Analysis): string => {
  if (row.startTime && row.stopTime) {
    return diffTime(row.startTime, row.stopTime);
  }
  return '';
};

const columns: QTableProps['columns'] = [
  {
    name: 'status',
    field: 'status',
    label: t('analysis.list.listTableLabel.status'),
    sortable: true,
  },
  {
    name: 'name',
    field: 'name',
    label: t('analysis.list.listTableLabel.name'),
    sortable: true,
  },
  {
    name: 'executionTime',
    field: 'startTime', // データ内に存在しないKeyだとソートが効かないためstartTimeを指定
    label: t('analysis.list.listTableLabel.executionTime'),
    format: (val: string, row: Analysis) => {
      return getExecutionTime(row);
    },
    sort: (a, b, rowA: Analysis, rowB: Analysis) => {
      return getExecutionTime(rowA) > getExecutionTime(rowB) ? 1 : -1;
    },
    sortable: true,
  },
  {
    name: 'creationTime',
    field: 'creationTime',
    label: t('analysis.list.listTableLabel.creationTime'),
    format: (val: string) => {
      return formatDatetime(val);
    },
    sortable: true,
  },
  {
    name: 'startTime',
    field: 'startTime',
    label: t('analysis.list.listTableLabel.startTime'),
    format: (val: string) => {
      return formatDatetime(val);
    },
    sortable: true,
  },
  {
    name: 'stopTime',
    field: 'stopTime',
    label: t('analysis.list.listTableLabel.stopTime'),
    format: (val: string) => {
      return formatDatetime(val);
    },
    sortable: true,
  },
];
</script>

<template>
  <table-base
    :rows="rows"
    :columns="columns"
    :loading="loading"
    :error="error"
  />
</template>
