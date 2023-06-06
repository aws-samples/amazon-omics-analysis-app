<script setup lang="ts">
import { defineComponent } from 'vue';
defineComponent({
  name: 'BtnDelete',
});

defineEmits<{
  (e: 'click'): void;
}>();
</script>

<template>
  <q-btn
    :label="$t('btn.delete')"
    color="negative"
    icon="delete"
    @click="
      ($event) => {
        $emit('click', $event);
      }
    "
  />
</template>
