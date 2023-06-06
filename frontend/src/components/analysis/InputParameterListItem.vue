<script setup lang="ts">
import {
  defineComponent,
  onBeforeMount,
  getCurrentInstance,
  onUnmounted,
  ref,
  onMounted,
  computed,
} from 'vue';
import InputValidationText from '../common/InputValidationText.vue';
import InputValidationRadio from '../common/InputValidationRadio.vue';
import * as yup from 'yup';
import { useForm } from 'vee-validate';
import { useValidationStore } from 'stores/validation-store';
import {
  ParameterValue,
  ParameterDescription,
  SetInitValueOption,
  WorkflowParameterDefinition,
} from 'src/@types/analysis';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

defineComponent({
  name: 'InputParameterListItem',
});

const props = defineProps<{
  value: ParameterValue;
  label: string;
  parameterDef?: WorkflowParameterDefinition;
  setInitValue?: SetInitValueOption;
  advanced?: boolean;
  onChange?: (key: string, value: ParameterValue) => void;
}>();

// DescriptionからParameterの定義を設定
const paramOptions = ref<
  {
    label: string;
    value: string | number | null;
  }[]
>([]);

const description: ParameterDescription = {
  caption: props.parameterDef?.description,
};
const { paramType, options, initialValue, caption } = description;

// 入力の種類ごとにOptionの設定
if (paramType === 'boolean') {
  // booleanの場合はYes,No
  paramOptions.value = [
    {
      label: t('analysis.info.parameter.params.true'),
      value: 'true',
    },
    {
      label: t('analysis.info.parameter.params.false'),
      value: 'false',
    },
  ];
} else if (options) {
  // 選択肢がある場合は、定義に沿って選択肢を表示
  paramOptions.value = options.split('|').map((option) => {
    const [label, value] = option.split(':');
    return {
      label: label,
      value: value ?? label,
    };
  });
  // オプショナルな選択肢の場合は、未選択の選択肢を追加
  if (props.parameterDef?.optional) {
    paramOptions.value.push({
      label: t('analysis.info.parameter.params.notSpecified'),
      value: null,
    });
  }
}

// Valueを表示用にパースする
const parseValue = (value: ParameterValue): string | null => {
  return value !== null ? String(value) : null;
};

// データ型に合わせてCastする
const castValue = (val: ParameterValue): ParameterValue => {
  if (val === null || val === '') {
    return null;
  }

  if (paramType === 'number' && !Number.isNaN(Number(val))) {
    return Number.parseFloat(val?.toString() ?? '');
  } else if (paramType === 'integer' && !Number.isNaN(Number(val))) {
    return Number.parseInt(val?.toString() ?? '');
  } else if (paramType === 'boolean') {
    return 'true' === val;
  }
  return String(val);
};

// 変更用のハンドラーが未設定の場合はReadOnlyとする
const readonly = computed<boolean>(() => {
  return !props.onChange;
});
const updateValue = (value: ParameterValue) => {
  if (props.onChange) {
    props.onChange(props.label, castValue(value));
  }
};
onMounted(() => {
  //初期値の設定
  if (props.setInitValue?.shouldSet) {
    // Forceがfalseの場合は、valueを上書きしない
    if (props.setInitValue.force === false && props.value !== null) {
      return;
    }

    if (paramType === 'boolean') {
      // booleanの場合、初期値の指定がない場合はFalse
      updateValue(initialValue ?? 'false');
    } else {
      // それ以外の場合、初期値の指定がない場合は空欄
      updateValue(initialValue ?? null);
    }
  }
});

// Validation用のスキーマ定義
let valueValidationDef:
  | yup.StringSchema<string | null | undefined, yup.AnyObject, undefined, ''>
  | yup.NumberSchema<number | null | undefined, yup.AnyObject, undefined, ''>
  | yup.BooleanSchema<boolean | null | undefined, yup.AnyObject, undefined, ''>;

// データ型ごとの設定
if (paramType === 'boolean') {
  valueValidationDef = yup.boolean();
} else if (paramType === 'number') {
  valueValidationDef = yup
    .number()
    .transform((value, originalValue) =>
      String(originalValue).trim() === '' || originalValue === null
        ? null
        : value
    );
} else if (paramType === 'integer') {
  valueValidationDef = yup
    .number()
    .integer()
    .transform((value, originalValue) =>
      String(originalValue).trim() === '' || originalValue === null
        ? null
        : value
    );
} else {
  valueValidationDef = yup.string();
}

// 必須チェックの設定
// オプショナルな項目はNullの入力を可能とする
if (!props.parameterDef?.optional) {
  valueValidationDef = valueValidationDef.required();
} else {
  valueValidationDef = valueValidationDef.nullable();
}

// スキーマのKey名をInputのnameに設定する
const schema = yup.object({
  value: valueValidationDef,
});
// Validation用のForm定義
const { validate } = useForm({
  validationSchema: schema,
});

// 複数コンポーネントにまたがっているため、ValidationはStoreで管理する
const validationStore = useValidationStore();

// StoreにValidationの定義を格納する
const key = getCurrentInstance()?.vnode.key?.toString() ?? '';
onBeforeMount(() => {
  // ReadOnlyの際はValidationを行わない
  if (!readonly.value) {
    validationStore.setValidateFunc(key, validate);
  }
});
// 画面遷移時にStoreから定義を削除する
onUnmounted(() => {
  if (!readonly.value) {
    validationStore.removeValidateFunc(key);
  }
});
</script>

<template>
  <q-item>
    <q-item-section>
      <div class="column q-col-gutter-sm">
        <div v-if="paramOptions.length > 0">
          <input-validation-radio
            name="value"
            :label="label"
            :model-value="parseValue(value)"
            :options="paramOptions"
            @update:model-value="
              (val) => {
                updateValue(val ?? null);
              }
            "
          />
        </div>
        <input-validation-text
          v-else
          name="value"
          :model-value="parseValue(value)"
          outlined
          :label="label"
          :readonly="readonly"
          @update:model-value="
            (val) => {
              updateValue(val ?? null);
            }
          "
        />
        <q-item-label caption>
          <q-chip
            v-if="advanced"
            square
            color="accent"
            class="text-white text-bold"
            size="sm"
            :label="$t('analysis.info.parameter.params.advanced')"
          />
          <q-chip
            v-if="!parameterDef?.optional"
            square
            color="negative"
            class="text-white text-bold"
            size="sm"
            :label="$t('analysis.info.parameter.params.required')"
          />

          {{ caption }}
        </q-item-label>
      </div>
    </q-item-section>
  </q-item>
  <q-separator />
</template>
