import { defineStore } from 'pinia';
import { useForm } from 'vee-validate';

/**
 * バリデーション結果を管理するStore
 */
export const useValidationStore = defineStore('validation', {
  state: () => ({
    isValid: true as boolean,
    validateFuncList: {} as {
      [key: string]: ReturnType<typeof useForm>['validate'];
    },
  }),
  actions: {
    setValidateFunc(key: string, func: ReturnType<typeof useForm>['validate']) {
      this.validateFuncList[key] = func;
    },
    removeValidateFunc(key: string) {
      delete this.validateFuncList[key];
    },
    async validate() {
      const results = await Promise.all(
        Object.keys(this.validateFuncList).map((key) =>
          this.validateFuncList[key]()
        )
      );
      return {
        isValid: results.every((result) => result.valid),
        results,
      };
    },
  },
});
