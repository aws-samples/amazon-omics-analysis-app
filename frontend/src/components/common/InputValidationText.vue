<script setup lang="ts">
import { useField } from 'vee-validate';
import { defineProps, toRef, defineEmits, defineComponent } from 'vue';

type ValueType = string | number | null | undefined;

defineComponent({
  name: 'InputValidationText',
});

const props = defineProps<{
  modelValue: ValueType;
  name: string;
  label?: string;
  readonly?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: ValueType): void;
}>();

// props.nameとKeyが一致したスキーマ情報でValidationを行う
// 以下の設定を行うことで、VeeValidateがValidationを実行できるようになる
const nameRef = toRef(props, 'name');
const { errorMessage, value } = useField<ValueType>(nameRef);
</script>

<template>
  <div>
    <q-input
      :model-value="value"
      :label="label"
      outlined
      :readonly="readonly"
      :error="!!errorMessage"
      :error-message="errorMessage"
      hide-bottom-space
      @update:model-value="
        (val) => {
          emit('update:modelValue', val);
        }
      "
    />
  </div>
</template>
