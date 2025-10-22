import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import frCommon from "@locales/fr/common.json";
import enCommon from "@locales/en/common.json";
import frNavbar from "@locales/fr/navbar.json";
import enNavbar from "@locales/en/navbar.json";
import frPages from "@locales/fr/pages.json";
import enPages from "@locales/en/pages.json";
import frSearch from "@locales/fr/search.json";
import enSearch from "@locales/en/search.json";
import frQuota from "@locales/fr/quota.json";
import enQuota from "@locales/en/quota.json";
import frBenchmark from "@locales/fr/benchmark.json";
import enBenchmark from "@locales/en/benchmark.json";

const DEFAULT_LANG = 'fr';

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      fr: {
        common: frCommon,
        navbar: frNavbar,
        pages: frPages,
        search: frSearch,
        quota: frQuota
      },
      en: {
        common: enCommon,
        navbar: enNavbar,
        pages: enPages,
        search: enSearch,
        quota: enQuota
      }
    },
    lng: DEFAULT_LANG,
    fallbackLng: DEFAULT_LANG,
    ns: ['common', 'navbar', 'pages', 'search', 'quota'],
    interpolation: { escapeValue: false },
    defaultNS: 'common'
  });

export default i18n;
