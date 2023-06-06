import { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      {
        name: 'index',
        path: '',
        redirect: { name: 'analysisList' },
      },
      {
        path: '/analysis',
        children: [
          {
            name: 'newAnalysis',
            path: 'run',
            component: () => import('pages/NewAnalysisPage.vue'),
          },
          {
            name: 'rerunAnalysis',
            path: 're-run/:id',
            component: () => import('pages/NewAnalysisPage.vue'),
          },
          {
            name: 'analysisList',
            path: 'list',
            component: () => import('pages/AnalysisListPage.vue'),
          },
          {
            name: 'analysisResult',
            path: 'result/:id',
            component: () => import('pages/AnalysisResultPage.vue'),
          },
        ],
      },
    ],
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
];

export default routes;
