<script setup lang="ts">
import { humanFileSize } from '@aws-amplify/ui';
import { computed, defineComponent, ref } from 'vue';
import { OutputItem } from 'src/@types/analysis';
import useAnalysis from 'src/services/useAnalysis';
import { useI18n } from 'vue-i18n';

defineComponent({
  name: 'ItemOutput',
});

const props = defineProps<{
  runId: string;
  item: OutputItem;
}>();

const children = ref<OutputItem[]>([]);
const analysis = useAnalysis();
const { t } = useI18n();

const isFolder = computed(() => {
  return !props.item.size;
});

const label = computed<string>(() => {
  const tmp = props.item.path.replace(/\/$/, '');
  return tmp.split('/').slice(-1)[0];
});

const loading = ref<boolean>(false);
// Expandされたら配下のデータを取得して、子要素として設定する
const onShow = async () => {
  loading.value = true;
  try {
    const outputs = await analysis.getOutputs(props.runId, props.item.path, {
      mode: 'hierarchical',
    });

    // フォルダ -> ファイルの順で表示する
    children.value = [
      ...(outputs?.folders ?? []),
      ...(outputs?.contents ?? []),
    ];
  } finally {
    loading.value = false;
  }
};

const donwload = async (openInNewTab = false) => {
  try {
    // S3の署名付きURLを取得する
    const url = await analysis.getOutputUrl(
      props.runId,
      props.item.path,
      !openInNewTab
    );

    // 取得したURLのリンクを発火して、S3からファイルをダウンロードする
    const link = document.createElement('a');
    document.body.appendChild(link);
    link.href = url;

    // 別タブで開く場合はブランクのターゲットを指定
    if (openInNewTab) {
      link.target = '_blank';
    }

    link.click();
    document.body.removeChild(link);
  } finally {
  }
};
</script>

<template>
  <q-expansion-item
    v-if="isFolder"
    switch-toggle-side
    :header-inset-level="0"
    :content-inset-level="1"
    expand-separator
    dense
    @show="
      () => {
        onShow();
      }
    "
  >
    <q-linear-progress v-if="loading" indeterminate size="xs" />
    <template v-slot:header>
      <div class="row items-center full-width">
        <div>
          <q-icon name="o_folder" size="xs" />
          <span class="q-ml-sm">{{ label }}</span>
        </div>
      </div>
    </template>

    <!-- 再起的に読み込むことで階層表示を実現する -->
    <item-output
      :run-id="runId"
      v-for="(child, childIdx) in children"
      :key="childIdx"
      :item="child"
    />
  </q-expansion-item>
  <div v-else>
    <q-item dense>
      <q-item-section>
        <div class="row justify-between items-center full-width">
          <div class="col">
            <q-icon name="o_insert_drive_file" size="xs" />
            <a
              :href="item.path"
              @click.prevent="
                () => {
                  donwload(true);
                }
              "
            >
              <span class="q-ml-sm">{{ label }}</span>
            </a>
            <q-icon name="open_in_new" class="q-ml-xs" />
          </div>
          <div class="col-auto">
            <span class="text-caption q-mr-md">{{
              humanFileSize(item.size ?? 0, true, 1)
            }}</span>

            <q-btn
              size="sm"
              outline
              color="primary"
              @click="() => donwload()"
              >{{ t('analysis.result.outputs.download') }}</q-btn
            >
          </div>
        </div>
      </q-item-section>
    </q-item>
    <q-separator />
  </div>
</template>
