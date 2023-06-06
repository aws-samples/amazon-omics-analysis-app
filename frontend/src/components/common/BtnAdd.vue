<script setup lang="ts">
import { defineComponent } from 'vue';
defineComponent({
  name: 'BtnAdd',
});

defineEmits<{
  (e: 'click'): void;
}>();
</script>

<template>
  <q-btn
    :label="$t('btn.add')"
    color="positive"
    icon="add"
    @click="
      ($event) => {
        $emit('click', $event);
      }
    "
  />
</template>
