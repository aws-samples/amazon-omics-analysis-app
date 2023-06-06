<script setup lang="ts">
import { useField } from 'vee-validate';
import { useI18n } from 'vue-i18n';
import { defineProps, toRef, defineEmits, defineComponent } from 'vue';
import { WorkflowType } from 'src/@types/analysis';

defineComponent({
  name: 'SelectWorkflowType',
});

const props = defineProps<{
  name: string;
  label?: string;
  modelValue: WorkflowType;
  readonly?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: WorkflowType): void;
}>();

const { t } = useI18n();

const options = [
  {
    label: t('workflow.type.ready2run'),
    value: 'READY2RUN',
  },
  {
    label: t('workflow.type.private'),
    value: 'PRIVATE',
  },
];

// props.nameとKeyが一致したスキーマ情報でValidationを行う
// 以下の設定を行うことで、VeeValidateがValidationを実行できるようになる
const nameRef = toRef(props, 'name');
const { errorMessage, value } = useField<WorkflowType>(nameRef);
</script>

<template>
  <q-field
    :label="label"
    stack-label
    borderless
    :error="!!errorMessage"
    :error-message="errorMessage"
    hide-bottom-space
  >
    <template v-slot:control>
      <div class="q-gutter-sm">
        <q-radio
          v-for="(option, idx) in options"
          :key="idx"
          :model-value="value"
          :val="option.value"
          :label="option.label"
          :disable="readonly"
          @update:model-value="
            (val) => {
              emit('update:modelValue', val);
            }
          "
        />
      </div>
    </template>
  </q-field>
</template>
