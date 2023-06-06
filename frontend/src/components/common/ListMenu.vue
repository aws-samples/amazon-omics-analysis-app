<script setup lang="ts">
import { defineComponent } from 'vue';

export type ListMenuProps = {
  title: string;
  caption?: string;
  icon?: string;
  link: {
    name: string;
  };
};

defineProps<ListMenuProps>();

defineComponent({
  name: 'EssentialLink',
});
</script>

<template>
  <q-item clickable :to="link" exact>
    <q-item-section v-if="icon" avatar>
      <q-icon :name="icon" />
    </q-item-section>

    <q-item-section>
      <q-item-label>{{ title }}</q-item-label>
      <q-item-label caption>{{ caption }}</q-item-label>
    </q-item-section>
  </q-item>
</template>
