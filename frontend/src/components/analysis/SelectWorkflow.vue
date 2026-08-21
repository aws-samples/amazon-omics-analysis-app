<script setup lang="ts">
import { Workflow, WorkflowType } from 'src/@types/analysis';
import useAnalysis from 'src/services/useAnalysis';
import { useField } from 'vee-validate';
import { defineComponent, ref, toRef, watch } from 'vue';
import _ from 'lodash';

defineComponent({
  name: 'SelectWorkflow',
});

const props = defineProps<{
  workflowType: WorkflowType;
  name: string;
  modelValue: Workflow | undefined;
  readonly?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:model-value', value: Workflow): void;
}>();

const workflowOptions = ref<Workflow[]>();
const analysis = useAnalysis();

const loadWorkflows = async (
  val: string,
  update: (callback: () => void) => void
) => {
  if (workflowOptions.value) {
    update(() => {
      // do nothing.
    });
    return;
  }

  const allWorkflows = _.sortBy(
    await analysis.getAllWorkflows(props.workflowType),
    (workflow) => workflow.name
  );

  update(() => {
    workflowOptions.value = allWorkflows;
  });
};

// props.nameとKeyが一致したスキーマ情報でValidationを行う
// 以下の設定を行うことで、VeeValidateがValidationを実行できるようになる
const nameRef = toRef(props, 'name');
// vee-validate v4.10以降はmodelValueの自動追跡(syncVModel)が
// デフォルト無効のため、明示的に有効化する
const { errorMessage, value } = useField<Workflow | undefined>(
  nameRef,
  undefined,
  { syncVModel: true }
);

watch(
  () => props.workflowType,
  () => {
    if (!props.readonly) {
      value.value = undefined;
      workflowOptions.value = undefined;
    }
  }
);
</script>

<template>
  <q-select
    :model-value="value"
    :options="workflowOptions"
    map-options
    option-label="name"
    @filter="loadWorkflows"
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
