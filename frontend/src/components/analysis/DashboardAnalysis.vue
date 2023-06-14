<script setup lang="ts">
import { createEmbeddingContext } from 'amazon-quicksight-embedding-sdk';
import useAnalysis from 'src/services/useAnalysis';
import { defineComponent, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BannerError from '../common/BannerError.vue';
import BannerAttention from '../common/BannerAttention.vue';

defineComponent({
  name: 'DashboardAnalysis',
});

const props = defineProps<{
  runId: string;
  visualizationId: string;
}>();

const analysis = useAnalysis();
const { t } = useI18n();

const loading = ref<boolean>(true);
const error = ref<boolean>(false);
const dashboardUrl = ref<string>('');

const dashboard = ref<HTMLElement>();
onMounted(async () => {
  try {
    const { embedDashboard } = await createEmbeddingContext();

    // ダッシュボード埋め込み用のQuickSightのURLを取得
    dashboardUrl.value = await analysis.getDashboardUrl(props.runId, props.visualizationId);

    // SDKを利用してダッシュボードを埋め込む
    await embedDashboard(
      {
        url: dashboardUrl.value,
        container: dashboard.value ?? '',
        withIframePlaceholder: true,
        height: '700px',
        width: '100%',
        onChange: (changeEvent) => {
          if (changeEvent.eventLevel === 'ERROR') {
            console.log(
              `Do something when embedding experience failed with "${changeEvent.eventName}"`
            );
            console.log(changeEvent);
            return;
          }
          switch (changeEvent.eventName) {
            case 'FRAME_MOUNTED': {
              console.log('Do something when the experience frame is mounted.');
              break;
            }
            case 'FRAME_LOADED': {
              console.log('Do something when the experience frame is loaded.');
              break;
            }
            //...
          }
        },
      },
      {
        parameters: [
          {
            Name: 'runId',
            Values: [props.runId],
          },
        ],
      }
    );
  } catch {
    error.value = true;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <q-skeleton v-if="loading" height="150px" />

  <banner-error v-else-if="error">
    {{ t('analysis.result.dashboard.otherError') }}
  </banner-error>
  <banner-attention v-else-if="!dashboardUrl">
    {{ t('analysis.result.dashboard.notFoundError') }}
  </banner-attention>
  <div ref="dashboard"></div>
</template>
