<script setup lang="ts">
import { Analysis } from 'src/@types/analysis';
import { formatDatetime } from 'src/utils/DateUtils';
import { defineComponent } from 'vue';

defineComponent({
  name: 'DisplayBasicInfo',
});

defineProps<{
  value: Analysis | undefined;
}>();
</script>

<template>
  <div>
    <div class="row q-gutter-sm q-mb-sm">
      <q-input
        :model-value="value?.name"
        class="col-6"
        outlined
        readonly
        :label="$t('analysis.info.basic.params.name')"
      />
      <q-input
        :model-value="value?.status"
        class="col-5"
        outlined
        readonly
        :label="$t('analysis.info.basic.params.status')"
      />
      <q-input
        :model-value="value?.arn"
        class="col-8"
        outlined
        readonly
        :label="$t('analysis.info.basic.params.arn')"
      />
    </div>
    <div class="row q-gutter-sm">
      <q-input
        :model-value="formatDatetime(value?.creationTime)"
        class="col-3"
        outlined
        readonly
        :label="$t('analysis.info.basic.params.creationTime')"
      />
      <q-input
        :model-value="formatDatetime(value?.startTime)"
        class="col-3"
        outlined
        readonly
        :label="$t('analysis.info.basic.params.startTime')"
      />
      <q-input
        :model-value="formatDatetime(value?.stopTime)"
        class="col-3"
        outlined
        readonly
        :label="$t('analysis.info.basic.params.stopTime')"
      />
    </div>
  </div>
</template>
