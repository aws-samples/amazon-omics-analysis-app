<script setup lang="ts">
import { Visualization, Workflow } from 'src/@types/analysis';
import useAnalysis, { GetVisualizationsResponse } from 'src/services/useAnalysis';
import { useField } from 'vee-validate';
import { defineComponent, ref, toRef, watch } from 'vue';
import _ from 'lodash';

defineComponent({
  name: 'SelectVisualization',
});

const props = defineProps<{
  workflow?: Workflow;
  name: string;
  modelValue?: Visualization;
  readonly?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:model-value', value: Visualization): void;
}>();

const visualizationOptions = ref<Visualization[]>();
const analysis = useAnalysis();

const loadVisualizations = async (
  val: string,
  update: (callback: () => void) => void
) => {
  if (visualizationOptions.value) {
    update(() => {
      // do nothing.
    });
    return;
  }

  let allVisualizations: Visualization[] = [];
  let startingToken: string | undefined = undefined;
  do {
    const visualizations: GetVisualizationsResponse = await analysis.getVisualizations(props.workflow!.type, props.workflow!.id, startingToken);
    allVisualizations.push(...visualizations.items);
    startingToken = visualizations.nextToken;
  } while (startingToken);

  allVisualizations = _.sortBy(allVisualizations, visualization => visualization.name);

  update(() => {
    visualizationOptions.value = allVisualizations;
  });
};

// props.nameとKeyが一致したスキーマ情報でValidationを行う
// 以下の設定を行うことで、VeeValidateがValidationを実行できるようになる
const nameRef = toRef(props, 'name');
const { errorMessage, value } = useField<Visualization | undefined>(nameRef);

watch(() => props.workflow, () => {
  if (!props.readonly) {
    value.value = undefined;
    visualizationOptions.value = undefined;
  }
});
</script>

<template>
  <q-select
    :model-value="value"
    :options="visualizationOptions"
    map-options
    option-label="name"
    :disable="!props.workflow"
    @filter="loadVisualizations"
    outlined
    :readonly="readonly"
    :error="!!errorMessage"
    :error-message="errorMessage"
    @update:model-value="
      (val) => {
        emit('update:model-value', val);
      }
    "
  />
</template>
