<script setup lang="ts">
import { defineComponent, ref } from 'vue';
import PageBase from '../components/common/PageBase.vue';
import BtnNewAnalysis from 'src/components/common/BtnNewAnalysis.vue';
import TableAnalysisList from 'src/components/analysis/TableAnalysisList.vue';
import { useRouter } from 'vue-router';
import useAnalysis, { GetRunsResponse } from 'src/services/useAnalysis';
import { Analysis } from 'src/@types/analysis';
import _ from 'lodash';
import BtnRefresh from 'src/components/common/BtnRefresh.vue';

defineComponent({
  components: { PageBase, BtnNewAnalysis, TableAnalysisList },
  name: 'AnalysisListPage',
});

const router = useRouter();

const analysis = useAnalysis();

const analysisList = ref<Analysis[]>([]);
const loadingAnalysisList = ref(true);
const error = ref(false);

const getAllRuns = async () => {
  let allRuns: Analysis[] = [];
  let startingToken: string | undefined = undefined;
  do {
    const runs: GetRunsResponse = await analysis.getRuns(startingToken);
    allRuns.push(...runs.items);
    startingToken = runs.nextToken;
  } while (startingToken);

  return _.sortBy(allRuns, (a) => new Date(a.creationTime).getTime() * -1);
};

// 検索処理
const search = async () => {
  try {
    loadingAnalysisList.value = true;
    error.value = false;
    analysisList.value = [];

    analysisList.value = await getAllRuns();
  } catch {
    error.value = true;
  } finally {
    loadingAnalysisList.value = false;
  }
};

// 初期表示時に検索を実行
(async () => {
  search();
})();

const onClickNewAnalysis = () => {
  router.push({
    name: 'newAnalysis',
  });
};

const onClickRow = (row: Analysis) => {
  router.push({
    name: 'analysisResult',
    params: {
      id: row.id,
    },
  });
};
</script>

<template>
  <page-base :title="$t('analysis.list.title')">
    <q-card flat bordered class="q-mx-sm">
      <q-card-section>
        <div class="row justify-end">
          <div class="col-auto q-mr-sm">
            <btn-refresh @click="search" />
          </div>
          <div class="col-auto">
            <btn-new-analysis @click="onClickNewAnalysis" />
          </div>
        </div>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <table-analysis-list
          :rows="analysisList"
          :loading="loadingAnalysisList"
          :error="error"
          @row-click="
            (evt: Event, row: Analysis, index: number) => {
              onClickRow(row)
            }
          "
        />
      </q-card-section>
    </q-card>
  </page-base>
</template>
