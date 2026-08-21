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
// vee-validate v4.10以降はmodelValueの自動追跡(syncVModel)が
// デフォルト無効のため、明示的に有効化する
const { errorMessage, value } = useField<ValueType>(nameRef, undefined, {
  syncVModel: true,
});
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
