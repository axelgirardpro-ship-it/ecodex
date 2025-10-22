import 'i18next';

import common from '@locales/en/common.json';
import navbar from '@locales/en/navbar.json';
import pages from '@locales/en/pages.json';
import search from '@locales/en/search.json';
import quota from '@locales/en/quota.json';
import benchmark from '@locales/en/benchmark.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof common;
      navbar: typeof navbar;
      pages: typeof pages;
      search: typeof search;
      quota: typeof quota;
      benchmark: typeof benchmark;
    };
  }
}







