import { boot } from 'quasar/wrappers';
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { Notify } from 'quasar';
import { fetchAuthSession } from 'aws-amplify/auth';

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $axios: AxiosInstance;
  }
}

// Be careful when using SSR for cross-request state pollution
// due to creating a Singleton instance here;
// If any client changes this (global) instance, it might be a
// good idea to move this instance creation inside of the
// "export default () => {}" function below (which runs individually
// for each client)

// 通常利用するインスタンス
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// 独自のエラーハンドリングを行うためのインスタンス
const apiWithoutErrorHandling = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

const requestHandler = async (config: InternalAxiosRequestConfig) => {
  // Cognitoの認証情報を取得して、RequestヘッダにIDトークンを設定する
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken;
  if (token != null) {
    config.headers['Authorization'] = token.toString();
  }
  return config;
};

export default boot(({}) => {
  // Requestの前処理
  api.interceptors.request.use(requestHandler);
  apiWithoutErrorHandling.interceptors.request.use(requestHandler);

  // Responseの共通処理
  // エラーハンドリングを行わないインスタンスには共通処理を設定しない
  api.interceptors.response.use(
    (res) => {
      // 正常時は何もしない
      return res;
    },
    (error) => {
      // エラーが発生したら通知を表示する
      Notify.create({
        color: 'negative',
        position: 'top',
        message: error.message,
      });
      return Promise.reject(error);
    }
  );
});

export { api, apiWithoutErrorHandling };
