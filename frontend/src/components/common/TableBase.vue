<script setup lang="ts">
import { QTable } from 'quasar';
import { defineComponent } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

defineComponent({
  name: 'TableBase',
});

defineProps<{
  error?: boolean;
  expandable?: boolean;
}>();
</script>

<template>
  <q-table>
    <template v-if="expandable" v-slot:header="props">
      <q-tr :props="props">
        <q-th auto-width />
        <q-th v-for="col in props.cols" :key="col.name" :props="props">
          {{ col.label }}
        </q-th>
      </q-tr>
    </template>
    <template v-if="expandable" v-slot:body="props">
      <q-tr :props="props">
        <q-td v-if="expandable" auto-width>
          <slot name="expand-button" :props="props">
            <q-btn
              size="sm"
              color="primary"
              round
              dense
              @click="props.expand = !props.expand"
              :icon="props.expand ? 'remove' : 'add'"
            />
          </slot>
        </q-td>
        <q-td v-for="col in props.cols" :key="col.name" :props="props">
          {{ col.value }}
        </q-td>
      </q-tr>
      <q-tr v-if="expandable" v-show="props.expand" :props="props">
        <q-td colspan="100%">
          <slot name="expand-item" :props="props"></slot>
        </q-td>
      </q-tr>
    </template>

    <template v-if="error" v-slot:bottom>
      <q-chip square color="negative" text-color="white" icon="error"
        >ERROR</q-chip
      >
      <span class="text-negative">
        {{ t('table.networkError') }}
      </span>
    </template>
    <template v-if="error" v-slot:no-data>
      <q-chip square color="negative" text-color="white" icon="error"
        >ERROR</q-chip
      >
      <span class="text-negative">
        {{ t('table.networkError') }}
      </span>
    </template>
  </q-table>
</template>
