<script setup lang="ts">
import { defineComponent } from 'vue';
defineComponent({
  name: 'PageBase',
});

type Props = {
  title: string;
};
defineProps<Props>();
</script>

<template>
  <q-page>
    <div class="row q-ma-sm">
      <div class="text-h6 col">
        {{ title }}
      </div>
    </div>

    <slot />
  </q-page>
</template>
