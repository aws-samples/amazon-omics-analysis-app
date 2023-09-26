<script setup lang="ts">
import { WorkflowVisualizer, Workflow } from 'src/@types/analysis';
import useAnalysis, { GetWorkflowVisualizersResponse } from 'src/services/useAnalysis';
import { useField } from 'vee-validate';
import { defineComponent, ref, toRef, watch } from 'vue';
import _ from 'lodash';

defineComponent({
  name: 'SelectVisualizer',
});

const props = defineProps<{
  workflow?: Workflow;
  name: string;
  modelValue?: WorkflowVisualizer;
  readonly?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:model-value', value: WorkflowVisualizer): void;
}>();

const visualizerOptions = ref<WorkflowVisualizer[]>();
const analysis = useAnalysis();

const loadVisualizers = async (
  val: string,
  update: (callback: () => void) => void
) => {
  if (visualizerOptions.value || !props.workflow) {
    update(() => {
      // do nothing.
    });
    return;
  }

  let allVisualizers: WorkflowVisualizer[] = [];
  let startingToken: string | undefined = undefined;
  do {
    const visualizers: GetWorkflowVisualizersResponse = await analysis.getWorkflowVisualizers(props.workflow.type, props.workflow.id, startingToken);
    allVisualizers.push(...visualizers.items);
    startingToken = visualizers.nextToken;
  } while (startingToken);

  allVisualizers = _.sortBy(allVisualizers, visualizer => visualizer.name);

  update(() => {
    visualizerOptions.value = allVisualizers;
  });
};

// props.nameとKeyが一致したスキーマ情報でValidationを行う
// 以下の設定を行うことで、VeeValidateがValidationを実行できるようになる
const nameRef = toRef(props, 'name');
const { errorMessage, value } = useField<WorkflowVisualizer | undefined>(nameRef);

watch(() => props.workflow, () => {
  if (!props.readonly) {
    value.value = undefined;
    visualizerOptions.value = undefined;
  }
});
</script>

<template>
  <q-select
    :model-value="value"
    :options="visualizerOptions"
    map-options
    option-label="name"
    :disable="!props.workflow"
    @filter="loadVisualizers"
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
