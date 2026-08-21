import globals from 'globals';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  {
    // 旧 .eslintignore からの移行
    ignores: [
      'dist/',
      'src-capacitor/',
      'src-cordova/',
      '.quasar/',
      'node_modules/',
      'src-ssr/',
      // 自動生成される型定義ファイル (先頭の eslint-disable が
      // ESLint 10 では unused directive 警告になるため除外)
      'src/env.d.ts',
      'src/quasar.d.ts',
      'src/stores/store-flag.d.ts',
    ],
  },

  // Rules order is important, please avoid shuffling them

  // ESLint typescript rules
  // https://typescript-eslint.io/users/configs#recommended
  ...tseslint.configs.recommended,

  // https://eslint.vuejs.org/rules/#available-rules
  // Priority A: Essential (Error Prevention)
  ...pluginVue.configs['flat/essential'],
  // Priority B: Strongly Recommended (Improving Readability)
  // ...pluginVue.configs['flat/strongly-recommended'],
  // Priority C: Recommended (Minimizing Arbitrary Choices and Cognitive Overhead)
  // ...pluginVue.configs['flat/recommended'],

  {
    languageOptions: {
      ecmaVersion: 2021,
      globals: {
        ...globals.browser,
        ...globals.node,
        ga: 'readonly', // Google Analytics
        cordova: 'readonly',
        __statics: 'readonly',
        __QUASAR_SSR__: 'readonly',
        __QUASAR_SSR_SERVER__: 'readonly',
        __QUASAR_SSR_CLIENT__: 'readonly',
        __QUASAR_SSR_PWA__: 'readonly',
        process: 'readonly',
        Capacitor: 'readonly',
        chrome: 'readonly',
      },
    },
  },

  {
    // *.vue ファイル内の <script lang="ts"> を TypeScript としてパースする
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
      },
    },
  },

  {
    // add your custom rules here
    rules: {
      'prefer-promise-reject-errors': 'off',
      quotes: ['warn', 'single', { avoidEscape: true }],

      // this rule, if on, would require explicit return type on the `render` function
      '@typescript-eslint/explicit-function-return-type': 'off',

      // in plain CommonJS modules, you can't use `import foo = require('foo')` to pass this rule, so it has to be disabled
      '@typescript-eslint/no-require-imports': 'off',

      // The core 'no-unused-vars' rules (in the eslint:recommended ruleset)
      // does not work with type definitions
      'no-unused-vars': 'off',

      // allow debugger during development only
      'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    },
  },

  // usage with Prettier, provided by 'eslint-config-prettier'.
  // https://github.com/prettier/eslint-config-prettier#installation
  prettierConfig
);
