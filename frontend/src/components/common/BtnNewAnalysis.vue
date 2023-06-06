<script setup lang="ts">
import { defineComponent } from 'vue';
defineComponent({
  name: 'BtnNewAnalysis',
});

defineEmits<{
  (e: 'click'): void;
}>();
</script>

<template>
  <q-btn
    :label="$t('btn.newAnalysis')"
    color="primary"
    icon="auto_awesome"
    @click="
      ($event) => {
        $emit('click', $event);
      }
    "
  />
</template>
