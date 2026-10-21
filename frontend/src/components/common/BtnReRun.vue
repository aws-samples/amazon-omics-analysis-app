<script setup lang="ts">
import { defineComponent } from 'vue';
defineComponent({
  name: 'BtnReRun',
});

defineEmits<{
  (e: 'click'): void;
}>();
</script>

<template>
  <q-btn
    :label="$t('btn.reRun')"
    color="primary"
    icon="autorenew"
    @click="$emit('click')"
  />
</template>
