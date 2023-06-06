<template>
  <!-- ログインしていない場合はAmplify UIのログイン画面が表示される -->
  <authenticator>
    <template v-slot:header>
      <div class="row justify-center items-center">
        <div class="text-h4 q-my-md">
          {{ $t('appName') }}
        </div>
      </div>
    </template>

    <!-- ログイン後に表示される画面をslotとして設定 -->
    <template v-slot>
      <router-view />
    </template>
  </authenticator>
</template>

<script setup lang="ts">
import '@aws-amplify/ui-vue/styles.css';
import { defineComponent } from 'vue';

defineComponent({
  name: 'App',
});
</script>
