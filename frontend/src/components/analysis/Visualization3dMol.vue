<script setup lang="ts">
import useAnalysis from 'src/services/useAnalysis';
import { defineComponent, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import * as $3Dmol from '3dmol/build/3Dmol-min.js';

import BannerError from '../common/BannerError.vue';
import { RunVisualization } from 'src/@types/analysis';

defineComponent({
  name: 'VisualizationThreedMol',
});

const props = defineProps<{
  runVisualization: RunVisualization;
}>();

const analysis = useAnalysis();
const { t } = useI18n();

const loading = ref<boolean>(true);
const error = ref<boolean>(false);

const target = ref<HTMLElement>();

onMounted(async () => {
  try {
    const viewer = $3Dmol.createViewer(target.value);

    if (props.runVisualization.pdbPath) {
      // PDB ファイルをダウンロードするための URL を取得する
      const url = await analysis.getOutputUrl(props.runVisualization.runId, props.runVisualization.pdbPath, false);
      await $3Dmol.download(`url: ${url}`, viewer, {});
    }

    viewer.setStyle({ cartoon: { color: 'spectrum' } });
    viewer.render();
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

  <div
    ref="target"
    :style="{
      height: '500px',
      width: '100%',
    }"
  ></div>
</template>
