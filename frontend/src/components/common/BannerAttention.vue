<script setup lang="ts">
import { defineComponent } from 'vue';

defineComponent({
  name: 'BannerAttention',
});
</script>

<template>
  <q-banner class="bg-accent text-white">
    <template v-slot:avatar>
      <q-icon name="info" />
    </template>
    <slot></slot>
  </q-banner>
</template>
