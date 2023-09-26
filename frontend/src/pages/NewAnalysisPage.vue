<script setup lang="ts">
import _ from 'lodash';
import { computed, defineComponent, ref, watch } from 'vue';
import PageBase from '../components/common/PageBase.vue';
import BtnRun from '../components/common/BtnRun.vue';
import FormSettings from '../components/analysis/FormSettings.vue';
import {
  AnalysisSettings,
  Analysis,
  Workflow,
  ParameterValue,
  StartAnalysisParams,
  SetInitValueOption,
} from 'src/@types/analysis';
import { useRoute, useRouter } from 'vue-router';
import useAnalysis from 'src/services/useAnalysis';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { useValidationStore } from 'stores/validation-store';
import InputParameterList from 'src/components/analysis/InputParameterList.vue';
import { AxiosError } from 'axios';

defineComponent({
  components: {
    PageBase,
    BtnRun,
    FormSettings,

    InputParameterList,
  },
  name: 'NewAnalysisPage',
});

const router = useRouter();
const route = useRoute();
const analysis = useAnalysis();
const $q = useQuasar();
const { t } = useI18n();
const validationStore = useValidationStore();

// 再実行対象のデータを取得する
const rerunAnalysis = ref<Analysis>();
let settings = ref<AnalysisSettings>({
  name: '',
  priority: 100,
  workflowType: 'READY2RUN',
});
let params = ref<Record<string, ParameterValue>>({});
const parameterDefs = ref<Workflow['parameterTemplate']>({});
// Parameterに初期値を設定すべきか
const setInitValueOption = ref<SetInitValueOption>({
  shouldSet: false,
  force: false,
});

// PathParamから対象のIDを取得
// 新規登録の際はrunIdを取得できない
const runId = _.isArray(route.params['id'])
  ? route.params['id'][0]
  : route.params['id'];

const isRerun = computed<boolean>(() => {
  return !!runId;
});

const step = ref(1);
// 画面遷移のタイミングでスクロールを最上部に戻す
watch(step, (newStep, oldStep) => {
  window.scrollTo(0, 0);

  // SettingsからParametersに遷移した場合だけ、初期値の設定を行う
  if (oldStep === 1 && newStep === 2) {
    setInitValueOption.value['shouldSet'] = true;
    // 再実行の時は既存のParameterを上書きしない
    if (isRerun.value) {
      setInitValueOption.value['force'] = false;
    } else {
      // 新規実行の際はParameterを上書きする
      setInitValueOption.value['force'] = true;
    }
  } else {
    setInitValueOption.value['shouldSet'] = false;
  }
});

// RouterにParamが設定されている場合はRerunの処理なので、既存のデータを取得する
if (isRerun.value) {
  (async () => {
    try {
      $q.loading.show();
      rerunAnalysis.value = await analysis.getRun(runId);
      const workflow = await analysis.getWorkflow(rerunAnalysis.value.workflowType, rerunAnalysis.value.workflowId);

      // 取得したデータを画面に反映する
      if (rerunAnalysis.value && workflow) {
        settings.value.name = rerunAnalysis.value.name;
        settings.value.storageCapacity = rerunAnalysis.value.storageCapacity;
        settings.value.priority = rerunAnalysis.value.priority;
        settings.value.workflowType = workflow.type;
        settings.value.workflow = workflow;
        params.value = rerunAnalysis.value.parameters;
      }
    } finally {
      // ローディング表示を非表示
      $q.loading.hide();
    }
  })();
}

// ワークフローのテンプレートからパラメーターをコピーする
const copyWorkflowParametersFromTemplate = async () => {
  const workflow = settings.value.workflow;
  if (workflow) {
    // ワークフローの詳細を取得
    const detailedWorkflow = await analysis.getWorkflow(workflow.type, workflow.id);
    if (detailedWorkflow) {
      // パラメーターの定義を設定
      parameterDefs.value = detailedWorkflow.parameterTemplate;

      // 取得したパラメータのテンプレートを元に画面処理用の変数を設定
      const temp: Record<string, ParameterValue> = {};
      Object.keys(detailedWorkflow.parameterTemplate).forEach((key) => {
        // 既に設定されているパラメータはそのまま初期設定する
        // 以下の場合にパラメータが設定された状態となる
        // * 再実行の場合（実行元のパラメータが設定されている）
        // * Backで戻った場合（ワークフローを変更しない限り、入力したパラメータを保持している）
        if (params.value[key]) {
          temp[key] = params.value[key];
        } else {
          temp[key] = null;
        }
      });
      params.value = temp;
    }
  }
};

const errorMessage = ref<{ code: string; message: string } | undefined>(
  undefined
);

// 実行処理
const onClickRun = () => {
  $q.dialog({
    title: t('analysis.run.dialog.runConfirmation.title'),
    message: t('analysis.run.dialog.runConfirmation.message'),
    cancel: true,
  }).onOk(async () => {
    // OKが押されたら実際に登録処理を実行する
    errorMessage.value = undefined;
    $q.loading.show({
      message: t('analysis.run.loading.message'),
    });

    try {
      // 未設定のパラメータを除いてから登録を実行する
      const registerParams: StartAnalysisParams['parameters'] = {};
      Object.keys(params.value).forEach((key) => {
        if (params.value[key]) {
          registerParams[key] = params.value[key];
        }
      });

      await analysis.startAnalysis({
        name: settings.value.name,
        priority: settings.value.priority,
        storageCapacity: settings.value.storageCapacity,
        workflowType: settings.value.workflow?.type,
        workflowId: settings.value.workflow?.id,
        parameters: registerParams,
        visualizerId: settings.value.visualizer?.visualizerId,
      });

      // 登録に成功したら一覧画面に戻って、通知を表示する
      await router.push({
        name: 'analysisList',
      });
      $q.notify({
        color: 'positive',
        message: t('analysis.run.notice.success'),
        position: 'top',
      });
    } catch (e) {
      console.error(e);
      if (e instanceof AxiosError) {
        errorMessage.value = {
          code: e.response?.data.code ?? '',
          message: e.response?.data.message ?? '',
        };
      }
    } finally {
      $q.loading.hide();
    }
  });
};

const onChange = (key: string, value: ParameterValue) => {
  params.value[key] = value;
};

const showContinue = ref<boolean>(true);

const onContinue = async () => {
  if (step.value === 1) {
    // Settings画面の制御
    // Parameters画面に遷移する際にTemplateを取得して設定
    await copyWorkflowParametersFromTemplate();
  }
  // 複数コンポーネントにまたがっているので、StoreでValidationを管理
  const result = await validationStore.validate();

  // Validationが正常であれば次のStepに進む
  if (result.isValid) {
    step.value++;
  } else {
    $q.notify({
      position: 'top',
      color: 'negative',
      message: t('analysis.run.error.validationErrorMessage'),
    });

    // エラーが発生したら、コンポーネントを非表示->表示にしてトランジションを発火させる
    // ボタンにアニメーションをつけて、エラー発生を強調する（項目が多くてわかりづらいため）
    showContinue.value = false;
    setTimeout(() => {
      showContinue.value = true;
    }, 100);
  }
};
</script>

<template>
  <page-base :title="$t('analysis.run.title')">
    <q-stepper
      v-model="step"
      ref="stepper"
      color="primary"
      animated
      class="q-mx-sm"
    >
      <q-step
        :name="1"
        :title="$t('analysis.run.setting.basic.title')"
        icon="settings"
        :done="step > 1"
      >
        <div class="text-h5 q-mb-sm">
          {{ $t('analysis.run.setting.basic.title') }}
        </div>
        <form-settings v-model="settings" />
      </q-step>

      <q-step
        :name="2"
        :title="$t('analysis.run.setting.parameter.title')"
        icon="edit_note"
        :done="step > 2"
      >
        <div class="text-h5 q-mb-sm">
          {{ $t('analysis.run.setting.parameter.title') }}
        </div>
        <input-parameter-list
          :params="params"
          :parameter-defs="parameterDefs"
          :set-init-value="setInitValueOption"
          :on-change="onChange"
        />
      </q-step>

      <q-step
        :name="3"
        :title="$t('analysis.run.setting.confirmation.title')"
        icon="text_snippet"
      >
        <div class="text-h5 q-mb-sm">
          {{ $t('analysis.run.setting.confirmation.title') }}
        </div>

        <q-banner v-if="errorMessage" class="bg-negative text-white q-mb-sm">
          <template v-slot:avatar>
            <q-icon name="error" />
          </template>
          <div class="text-h5">ERROR</div>
          <div>{{ errorMessage?.code }}</div>
          <div>{{ errorMessage?.message }}</div>
        </q-banner>

        <q-card class="q-mb-sm">
          <q-card-section>
            <div class="text-h6">
              {{ $t('analysis.run.setting.basic.title') }}
            </div>
          </q-card-section>

          <q-card-section>
            <div class="row q-gutter-sm">
              <form-settings :model-value="settings" :readonly="true" />
            </div>
          </q-card-section>
        </q-card>

        <q-card>
          <q-card-section>
            <div class="text-h6">
              {{ $t('analysis.run.setting.parameter.title') }}
            </div>
          </q-card-section>

          <q-card-section>
            <input-parameter-list
              :params="params"
              :parameter-defs="parameterDefs"
            />
          </q-card-section>
        </q-card>
      </q-step>

      <template v-slot:navigation>
        <q-stepper-navigation>
          <!-- バリデーションエラーの際にアニメーションさせる -->
          <transition
            :leave-active-class="step < 3 ? 'animated headShake' : ''"
          >
            <q-btn
              v-if="step < 3"
              v-show="showContinue"
              @click="onContinue"
              color="primary"
              :label="$t('analysis.run.setting.btn.continue')"
            />
          </transition>
          <btn-run v-if="step === 3" @click="() => onClickRun()" />
          <q-btn
            v-if="step > 1"
            flat
            color="negative"
            @click="
              () => {
                step--;
              }
            "
            :label="$t('analysis.run.setting.btn.back')"
            class="q-ml-sm"
          />
        </q-stepper-navigation>
      </template>
    </q-stepper>
  </page-base>
</template>
