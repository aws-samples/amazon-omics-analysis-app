<script setup lang="ts">
import { defineComponent, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ListMenu, { ListMenuProps } from '../components/common/ListMenu.vue';
import { useAuthenticator } from '@aws-amplify/ui-vue';
import { useRouter } from 'vue-router';

const { t } = useI18n();
const auth = useAuthenticator();
const router = useRouter();

const menuList: ListMenuProps[] = [
  {
    title: t('menu.analsysList'),
    icon: 'list',
    link: { name: 'analysisList' },
  },
  {
    title: t('menu.newAnalysis'),
    icon: 'auto_awesome',
    link: { name: 'newAnalysis' },
  },
];
const leftDrawerOpen = ref(false);
const toggleLeftDrawer = () => {
  leftDrawerOpen.value = !leftDrawerOpen.value;
};

const signOut = () => {
  auth.signOut();
};

defineComponent({
  name: 'MainLayout',
  components: {
    ListMenu,
  },
});
</script>

<template>
  <q-layout view="hHh LpR fFf">
    <q-header elevated>
      <q-toolbar>
        <q-btn
          flat
          dense
          round
          icon="menu"
          aria-label="Menu"
          @click="toggleLeftDrawer"
        />

        <q-toolbar-title>
          <q-btn
            :label="$t('appName')"
            flat
            size="lg"
            @click="
              () => {
                router.push({ name: 'analysisList' });
              }
            "
          />
        </q-toolbar-title>

        <q-btn :label="$t('signout')" flat icon="logout" @click="signOut" />
      </q-toolbar>
    </q-header>

    <q-drawer v-model="leftDrawerOpen" show-if-above bordered>
      <q-list>
        <list-menu v-for="link in menuList" :key="link.title" v-bind="link" />
      </q-list>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>
