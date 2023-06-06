import { boot } from 'quasar/wrappers';
/* eslint-enable @typescript-eslint/no-empty-interface */
import { Amplify } from 'aws-amplify';
import AmplifyVue from '@aws-amplify/ui-vue';

Amplify.configure({
  Auth: {
    region: import.meta.env.VITE_AUTH_REGION,
    userPoolId: import.meta.env.VITE_AUTH_USER_POOL_ID,
    userPoolWebClientId: import.meta.env.VITE_AUTH_WEB_CLIENT_ID,
    authenticationFlowType: 'USER_SRP_AUTH',
  },
});

export default boot(({ app }) => {
  // AmplifyUIの設定
  app.use(AmplifyVue);
});
