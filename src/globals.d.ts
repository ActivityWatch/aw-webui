// We will disable the no-shadow eslint rule for the entire file:
/* eslint-disable no-shadow */

import type { TranslationParams } from '~/i18n';

// Constants set at compile time
declare global {
  const PRODUCTION: boolean;
  const AW_SERVER_URL: string;
  const COMMIT_HASH: string;
}

declare module 'vue/types/vue' {
  interface Vue {
    $t(key: string, params?: TranslationParams): string;
  }
}

export {};
