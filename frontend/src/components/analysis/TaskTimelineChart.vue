<script setup lang="ts">
import { defineComponent, computed, defineProps } from 'vue';
import { AnalysisTask } from 'src/@types/analysis';
import _ from 'lodash';

import { ComposeOption, use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { BarChart, BarSeriesOption } from 'echarts/charts';
import {
  TitleComponentOption,
  TooltipComponent,
  TooltipComponentOption,
  GridComponent,
  GridComponentOption,
  LegendComponentOption,
  DataZoomComponent,
} from 'echarts/components';
import VChart from 'vue-echarts';
import { ref } from 'vue';
import { formatTime, formatFromMilliseconds } from 'src/utils/DateUtils';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

use([
  TooltipComponent,
  GridComponent,
  BarChart,
  CanvasRenderer,
  DataZoomComponent,
]);

type EChartsOption = ComposeOption<
  | TitleComponentOption
  | TooltipComponentOption
  | GridComponentOption
  | LegendComponentOption
  | BarSeriesOption
>;

// 時系列順に並び替え
const sortedTasks = computed(() =>
  _.sortBy(props.value, [
    (task) => new Date(task.startTime ?? '').getTime() * -1,
  ])
);

// 最終のタスク開始時間
const maxStartTime = computed(() =>
  new Date(
    sortedTasks.value[sortedTasks.value.length - 1].startTime ?? ''
  ).getTime()
);

// タスクごとのタスク実行時間（ミリ秒）
const times = computed(() =>
  sortedTasks.value.map(
    (task) =>
      new Date(task.stopTime ?? '').getTime() -
      new Date(task.startTime ?? '').getTime()
  )
);

// ワークフローの開始時間をx軸の起点（value = 0）とし、そこからの経過時間（ミリ秒）を求める
// このデータは余白を設定するために利用する（経過時間分x軸がズレて表示される）
const placeholders = computed(() =>
  sortedTasks.value.map(
    (task) => new Date(task.startTime ?? '').getTime() - maxStartTime.value
  )
);

const option = ref<EChartsOption>({
  tooltip: {
    trigger: 'axis',
    axisPointer: {
      type: 'shadow',
    },
    position: (pointer) => [0, pointer[1] - 100],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    formatter: function (params: any) {
      const startTime = maxStartTime.value + params[0].value;

      const endTime = startTime + params[1].value;

      return (
        params[0].name +
        '<br/>' +
        `${formatTime(startTime)} ~ ${formatTime(endTime)}` +
        '<br/>' +
        `${t(
          'analysis.result.task.listTableLabel.executionTime'
        )} : ${formatFromMilliseconds(endTime - startTime)}`
      );
    },
  },
  dataZoom: [
    {
      type: 'inside',
      start: 1000000,
      yAxisIndex: [0],
    },
  ],
  yAxis: {
    type: 'category',
    data: sortedTasks.value.map((task) => task.name),
    axisLabel: {
      inside: true,
      fontSize: 10,
      color: 'black',
      formatter: (val: string) => {
        const temp = val.split(':');
        return (
          temp.map((_, idx) => (idx <= temp.length ? '  ' : '')).join('') +
          temp.slice(-1)
        );
      },
    },
  },
  xAxis: {
    type: 'value',
    show: false,
  },
  series: [
    {
      name: 'Placeholder',
      type: 'bar',
      stack: 'Total',
      silent: true,
      itemStyle: {
        borderColor: 'transparent',
        color: 'transparent',
      },
      emphasis: {
        itemStyle: {
          borderColor: 'transparent',
          color: 'transparent',
        },
      },
      data: placeholders.value,
    },
    {
      type: 'bar',
      stack: 'Total',
      data: times.value,

      itemStyle: {
        color: 'rgba(25,118,210,0.5)',
      },
    },
  ],
});

defineComponent({
  name: 'TaskTimelineChart',
  components: {},
});

const props = defineProps<{
  value: AnalysisTask[];
}>();
</script>

<template>
  <v-chart
    :option="option"
    :init-options="{
      height: '600px',
    }"
    style="
       {
        height: '600px';
      }
    "
  />
</template>
