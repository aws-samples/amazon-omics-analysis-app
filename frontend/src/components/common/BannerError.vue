<script setup lang="ts">
import { defineComponent } from 'vue';

defineComponent({
  name: 'BannerError',
});
</script>

<template>
  <q-banner class="bg-negative text-white">
    <template v-slot:avatar>
      <q-icon name="error" />
    </template>
    <slot></slot>
  </q-banner>
</template>
