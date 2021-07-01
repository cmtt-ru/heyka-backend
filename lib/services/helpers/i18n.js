'use strict';

const { I18n } = require('i18n');
const path = require('path');

const i18n = new I18n({
  locales: ['en', 'de'],
  directory: path.join(__dirname, './locales'),
  defaultLocale: 'en',
  updateFiles: false,
  objectNotation: true,
});

module.exports = {i18n};
