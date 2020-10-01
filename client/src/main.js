import '@/constants';
import Vue from 'vue';
import App from './App.vue';
import router from './router';
import themes from '@sdk/themes';
import store from './store';
import i18n from '@sdk/translations/i18n';
import SvgIcon from '@components/SvgIcon.vue';
import API from '@api';
import '@sdk/directives';

Vue.prototype.$API = API;
Vue.component('SvgIcon', SvgIcon);
Vue.prototype.$themes = themes;

themes.manualSetTheme('light'); // TODO remove if dark theme can be selected

Vue.config.productionTip = false;

new Vue({
  router,
  store,
  i18n,
  mounted: () => document.dispatchEvent(new Event('x-app-rendered')),
  render: h => h(App),
}).$mount('#app');

/**
 * Dummy polyfill for `setSinkId` method for unsupported browsers e.g. Safari
 * @returns {void}
 */
if (Audio.setSinkId === undefined) {
  Audio.prototype.setSinkId = () => {};
}
