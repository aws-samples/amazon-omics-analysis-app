<script setup lang="ts">
import { defineComponent } from 'vue';
defineComponent({
  name: 'BtnBase',
});

defineProps<{
  label: string;
  iconOnly?: boolean;
}>();

defineEmits<{
  (e: 'click'): void;
}>();
</script>

<template>
  <q-btn
    :label="iconOnly ? '' : label"
    @click="
      ($event) => {
        $emit('click', $event);
      }
    "
  />
</template>
