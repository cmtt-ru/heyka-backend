/* eslint no-magic-numbers: 0 */
import Vue from 'vue';
import VueI18n from 'vue-i18n';

Vue.use(VueI18n);

const SYSTEM_LOCALE = 'en';

const supportedLocales = [];

const messages = loadLocaleMessages();

/**
 * Loads language files
 * @returns {array} all translation sheets
 */
function loadLocaleMessages() {
  const locales = require.context('./translations', true, /[A-Za-z0-9-_,\s]+\.json$/i);
  const msgs = {};

  locales.keys().forEach(key => {
    const matched = key.match(/([A-Za-z0-9-_]+)\./i);

    if (matched && matched.length > 1) {
      const locale = matched[1];

      supportedLocales.push(locale);

      msgs[locale] = locales(key);
    }
  });

  return msgs;
}

/**
 * Slavic Pluralisation rules
 * @param {number} choice - choice
 * @param {number} choicesLength - choicesLength
 * @returns {number}
 */
function slavicPluralization(choice, choicesLength) {
  if (choice === 0) {
    return 0;
  }

  const teen = choice > 10 && choice < 20;
  const endsWithOne = choice % 10 === 1;

  if (!teen && endsWithOne) {
    return 1;
  }

  if (!teen && choice % 10 >= 2 && choice % 10 <= 4) {
    return 2;
  }

  return (choicesLength < 4) ? 2 : 3;
}

export default new VueI18n({
  locale: SYSTEM_LOCALE,
  fallbackLocale: 'en',
  messages,
  pluralizationRules: {
    ru: slavicPluralization,
  },
  silentTranslationWarn: true,
  silentFallbackWarn: true,
});
