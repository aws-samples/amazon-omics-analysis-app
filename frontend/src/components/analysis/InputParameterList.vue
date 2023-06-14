<script setup lang="ts">
import { computed, defineComponent, ref } from 'vue';
import InputParameterListItem from 'src/components/analysis/InputParameterListItem.vue';
import {
  ParameterValue,
  ParameterDescription,
  SetInitValueOption,
  WorkflowParameterDefinition,
} from 'src/@types/analysis';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

// 高度な設定の境界値
const BOUNDARY_ADVANCED_CATEGORY = 10;
const BOUNDARY_ADVANCED_ITEM = 10;

defineComponent({
  name: 'InputParameterList',
  components: {
    InputParameterListItem,
  },
});

const props = defineProps<{
  params: Record<string, ParameterValue>;
  parameterDefs: { [parameterKey: string]: WorkflowParameterDefinition };
  setInitValue?: SetInitValueOption;
  onChange?: (key: string, value: ParameterValue) => void;
}>();

// 高度な設定カテゴリーの表示管理
const showsAdvancedCategory = ref<boolean>(false);

// 高度な設定パラメータの表示管理（配列でカテゴリごとに管理）
// 高度な設定パラメータが存在しないカテゴリはnullとする（ボタンを非表示にするため）
const showsAdvancedParams = ref<(boolean | null)[]>([]);

// 全ての高度なパラメータを表示しているかどうか
const showsAllAdvancedParams = computed<boolean | null>(() => {
  // いずれかの高度な設定が非表示であればFalse
  return !showsAdvancedParams.value.some((val) => val === false);
});

// カテゴリごとグルーピングして、Key・カテゴリ番号・項目番号を格納
const categoriesList = computed(() => {
  const categories: {
    key: string;
    category: number;
    item: number;
  }[] = [];

  Object.keys(props.parameterDefs).forEach((key) => {
    const description: ParameterDescription = {
      caption: props.parameterDefs[key].description,
    }
    const { category, item } = description;

    // カテゴリ番号と項目番号が未設定の場合は0とする
    categories.push({
      key,
      category: category ?? 0,
      item: item ?? 0,
    });
  });

  // カテゴリ、項目の昇順で並び替え
  categories.sort((a, b) =>
    a.category === b.category
      ? a.item === b.item
        ? a.key > b.key
          ? 1
          : -1
        : a.item > b.item
          ? 1
          : -1
      : a.category > b.category
        ? 1
        : -1
  );

  // カテゴリごと分割して2次元配列に格納し直す（Templateで処理しやすいため）
  const ret: (typeof categories)[] = [];
  let prevCateogry = -1;
  let temp: typeof categories = [];
  categories.forEach((cateogry) => {
    if (temp.length > 0 && prevCateogry !== cateogry.category) {
      ret.push([...temp]);
      temp = [];
    }
    prevCateogry = cateogry.category;
    temp.push(cateogry);
  });
  if (temp.length > 0 ) {
    ret.push([...temp]);
  }

  return ret;
});

const paramKeys = Object.keys(props.params);
const advancedCategoryKeys: string[] = [];
categoriesList.value.forEach((categories) => {
  const advancedParamKeys = categories
    .map((category) =>
      category.item >= BOUNDARY_ADVANCED_ITEM ? category.key : null
    )
    .filter((val) => val !== null) as string[];

  if (categories[0].category >= BOUNDARY_ADVANCED_CATEGORY) {
    advancedCategoryKeys.push(...categories.map((category) => category.key));
  }

  // 高度な設定の表示ボタンを表示するかどうかを設定
  // 引数のparamsに高度な設定が存在する場合のみ、表示ボタンを表示する（nullの場合はボタン非表示）
  // ※実行結果表示の場合は、実行時に設定したparamsしか設定されていない
  showsAdvancedParams.value.push(
    advancedParamKeys.some((v) => paramKeys.includes(v)) ? false : null
  );
});

// 高度な設定カテゴリが存在するかどうか
const existsAdvancedCategory = advancedCategoryKeys.some((v) =>
  paramKeys.includes(v)
);

// 全ての高度な設定パラメータの表示切り替え
const switchShowAllAdvancedParams = (newVal: boolean | null) => {
  showsAdvancedParams.value.forEach((val, idx) => {
    if (val !== null) {
      showsAdvancedParams.value[idx] = newVal;
    }
  });
};
</script>

<template>
  <div class="row justify-end">
    <q-toggle
      v-if="showsAdvancedParams.some((val) => val !== null)"
      :model-value="showsAllAdvancedParams"
      :label="t('analysis.info.parameter.params.showAllAdvancedParam')"
      @update:model-value="(newVal) => switchShowAllAdvancedParams(newVal)"
    />
  </div>
  <div class="column q-gutter-sm">
    <!-- カテゴリごとにListを分ける -->
    <div v-for="(categories, idx) in categoriesList" :key="'key' + idx">
      <q-list
        v-if="
          categories[0].category < BOUNDARY_ADVANCED_CATEGORY ||
          showsAdvancedCategory
        "
        bordered
        class="rounded-borders"
      >
        <div v-for="category in categories" :key="category.key">
          <!-- undefinedのパラメータは設定しない（未設定を初期設定にしたい場合はnullを設定すること） -->
          <div
            v-if="params[category.key] !== undefined"
            v-show="
              BOUNDARY_ADVANCED_ITEM > category.item || showsAdvancedParams[idx]
            "
          >
            <input-parameter-list-item
              :key="category.key"
              :value="params[category.key]"
              :label="category.key"
              :parameter-def="parameterDefs[category.key]"
              :set-init-value="setInitValue"
              :advanced="
                BOUNDARY_ADVANCED_CATEGORY <= category.category ||
                BOUNDARY_ADVANCED_ITEM <= category.item
              "
              :on-change="onChange"
            />
          </div>
        </div>
        <q-item
          v-if="showsAdvancedParams[idx] !== null"
          class="row justify-center"
        >
          <q-btn
            class="col-shrink"
            outline
            color="grey-8"
            :label="
              !showsAdvancedParams[idx]
                ? t('analysis.info.parameter.params.showAdvancedParam')
                : t('analysis.info.parameter.params.hideAdvancedParam')
            "
            @click="
              () => (showsAdvancedParams[idx] = !showsAdvancedParams[idx])
            "
          />
        </q-item>
      </q-list>
    </div>
  </div>
  <div
    v-if="existsAdvancedCategory"
    class="row items-center q-gutter-lg q-mt-sm"
  >
    <div class="col-grow">
      <q-separator v-if="!showsAdvancedCategory" />
    </div>
    <q-btn
      class="col-shrink"
      outline
      color="grey-8"
      :label="
        !showsAdvancedCategory
          ? t('analysis.info.parameter.params.showAdvancedCategory')
          : t('analysis.info.parameter.params.hideAdvancedCategory')
      "
      @click="() => (showsAdvancedCategory = !showsAdvancedCategory)"
    />
    <div class="col-grow">
      <q-separator v-if="!showsAdvancedCategory" />
    </div>
  </div>
</template>
