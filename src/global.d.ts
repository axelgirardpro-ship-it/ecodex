import 'i18next';

import frCommon from "@locales/fr/common.json";
import frNavbar from "@locales/fr/navbar.json";
import frPages from "@locales/fr/pages.json";
import frSearch from "@locales/fr/search.json";

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof frCommon;
      navbar: typeof frNavbar;
      pages: typeof frPages;
      search: typeof frSearch;
    };
  }
}
