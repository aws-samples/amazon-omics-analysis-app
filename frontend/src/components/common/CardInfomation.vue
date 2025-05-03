<script setup lang="ts">
import { defineComponent } from 'vue';
import BtnRefresh from './BtnRefresh.vue';

defineComponent({
  name: 'CardInfomation',
});

defineProps<{
  title: string;
  onRefresh?: () => void;
}>();
</script>

<template>
  <q-card>
    <q-card-section>
      <div class="row justify-between">
        <div class="text-h6">
          {{ title }}
        </div>
        <div v-if="onRefresh">
          <btn-refresh
            @click="
              {
                onRefresh ? onRefresh() : null;
              }
            "
          />
        </div>
      </div>
    </q-card-section>

    <q-card-section class="q-pt-none">
      <slot></slot>
    </q-card-section>
  </q-card>
</template>
