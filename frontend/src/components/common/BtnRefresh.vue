<script setup lang="ts">
import { defineComponent } from 'vue';
defineComponent({
  name: 'BtnRefresh',
});

defineEmits<{
  (e: 'click'): void;
}>();
</script>

<template>
  <q-btn
    icon="refresh"
    outline
    @click="
      ($event) => {
        $emit('click', $event);
      }
    "
  />
</template>
