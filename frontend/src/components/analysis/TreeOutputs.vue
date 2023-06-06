<script setup lang="ts">
import useAnalysis from 'src/services/useAnalysis';
import { defineComponent, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BannerAttention from '../common/BannerAttention.vue';
import { OutputItem } from 'src/@types/analysis';
import ItemOutput from './ItemOutput.vue';

defineComponent({
  name: 'TreeOutputs',
});

const props = defineProps<{
  runId: string;
}>();

const { t } = useI18n();

const analysis = useAnalysis();
const loading = ref<boolean>(true);

const outputNode = ref<OutputItem[]>([]);

(async () => {
  try {
    const outputs = await analysis.getOutputs(props.runId, '', {
      mode: 'hierarchical',
    });
    outputNode.value.push(
      ...(outputs?.folders ?? []),
      ...(outputs?.contents ?? []),
    );
  } finally {
    loading.value = false;
  }
})();
</script>

<template>
  <q-skeleton v-if="loading" height="150px" />
  <banner-attention v-else-if="!loading && outputNode.length === 0">
    {{ t('analysis.result.outputs.notFoundError') }}
  </banner-attention>
  <q-list v-else bordered class="rounded-borders">
    <item-output
      v-for="(item, idx) in outputNode"
      :key="idx"
      :run-id="runId"
      :item="item"
    />
  </q-list>
</template>
