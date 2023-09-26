<script setup lang="ts">
import { AnalysisSettings } from 'src/@types/analysis';
import { defineComponent, onBeforeMount, onUnmounted } from 'vue';
import InputValidationText from '../common/InputValidationText.vue';
import * as yup from 'yup';
import { useForm } from 'vee-validate';
import { useValidationStore } from 'stores/validation-store';

import SelectWorkflowType from './SelectWorkflowType.vue';
import SelectWorkflow from './SelectWorkflow.vue';
import SelectVisualizer from './SelectVisualizer.vue';

defineComponent({
  name: 'FormSettings',
});

const validationStore = useValidationStore();

const props = defineProps<{
  modelValue: AnalysisSettings;
  readonly?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: AnalysisSettings): void;
}>();

// props.modelValueはイミュータブルなので、updateイベントを発火させて親コンポーネントで更新する
const emitModelValue = (
  key: string,
  value: AnalysisSettings[keyof AnalysisSettings] | null | undefined
) => {
  emit(
    'update:modelValue',
    Object.assign({}, props.modelValue, { [key]: value })
  );
};

// Validation用のスキーマ定義
// スキーマのKey名をInputのnameに設定する
const schema = yup.object({
  name: yup.string().required().max(127),
  storageCapacity: yup.number(),
  priority: yup.number().min(0).max(1000),
  workflow: yup.object({}).json().required(),
});

// Validation用のForm定義
const { validate } = useForm({
  validationSchema: schema,
});

onBeforeMount(() => {
  if (!props.readonly) {
    validationStore.setValidateFunc('settings', validate);
  }
});
onUnmounted(() => {
  if (!props.readonly) {
    validationStore.removeValidateFunc('settings');
  }
});
</script>

<template>
  <div class="row q-gutter-sm">
    <input-validation-text
      name="name"
      :model-value="modelValue.name"
      class="col-5"
      outlined
      :readonly="readonly"
      :label="$t('analysis.info.setting.params.name')"
      @update:model-value="
        (val) => {
          emitModelValue('name', val);
        }
      "
    />
    <input-validation-text
      name="storageCapacity"
      :model-value="modelValue.storageCapacity"
      class="col-2"
      outlined
      :readonly="readonly"
      :label="$t('analysis.info.setting.params.storageCapacity')"
      @update:model-value="
        (val) => {
          emitModelValue('storageCapacity', val);
        }
      "
    />
    <input-validation-text
      name="priority"
      :model-value="modelValue.priority"
      class="col-2"
      outlined
      :readonly="readonly"
      :label="$t('analysis.info.setting.params.priority')"
      @update:model-value="
        (val) => {
          emitModelValue('priority', val);
        }
      "
    />

    <select-workflow-type
      name="workflowType"
      :model-value="modelValue.workflowType"
      class="col-3"
      :readonly="readonly"
      :label="$t('analysis.info.setting.params.workflowType')"
      @update:model-value="
        (val) => {
          emitModelValue('workflowType', val);
        }
      "
    />
    <select-workflow
      name="workflow"
      :workflow-type="modelValue.workflowType"
      :model-value="modelValue.workflow"
      class="col-4"
      :readonly="readonly"
      :label="$t('analysis.info.setting.params.workflow')"
      @update:model-value="
        (val) => {
          emitModelValue('workflow', val);
        }
      "
    />
    <select-visualizer
      name="visualizer"
      :model-value="modelValue.visualizer"
      :workflow="modelValue.workflow"
      class="col-4"
      :readonly="readonly"
      :label="$t('analysis.info.setting.params.visualizer')"
      @update:model-value="
        (val) => {
          emitModelValue('visualizer', val);
        }
      "
    />
  </div>
</template>
