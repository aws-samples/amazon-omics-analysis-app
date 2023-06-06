<script setup lang="ts">
import { defineComponent } from 'vue';
defineComponent({
  name: 'BtnRun',
});

defineEmits<{
  (e: 'click'): void;
}>();
</script>

<template>
  <q-btn
    :label="$t('btn.run')"
    color="primary"
    icon="play_circle_outline"
    @click="
      ($event) => {
        $emit('click', $event);
      }
    "
  />
</template>
