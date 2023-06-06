<script setup lang="ts">
import { useField } from 'vee-validate';
import { defineProps, toRef, defineEmits, defineComponent } from 'vue';

type ValueType = string | number | null | undefined;

defineComponent({
  name: 'InputValidationRadio',
});

const props = defineProps<{
  modelValue: ValueType;
  name: string;
  label?: string;
  options: {
    label: string;
    value: ValueType;
  }[];
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
          @update:model-value="
            (val) => {
              if (!readonly) {
                emit('update:modelValue', val);
              }
            }
          "
        />
      </div>
    </template>
  </q-field>
</template>
