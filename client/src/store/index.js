import Vue from 'vue';
import Vuex from 'vuex';
import createLogger from 'vuex/dist/logger';
import modules from './modules';
import actions from './actions';
import getters from './getters';
import state from './state';
import mutations from './mutations';

const plugins = [];

/**
 * Vuex logger plugin
 */
if (!IS_DEV) {
  plugins.push(createLogger({
    /**
     * Filter mutations to be logged
     * @param {object} mutation Mutation type and payload
     * @returns {boolean}
     */
    filter(mutation) {
      const ignoreList = [
        'app/SET_MICROPHONE_VOLUME',
      ];

      return !ignoreList.includes(mutation.type);
    },
    logActions: false,
  }));
}

Vue.use(Vuex);

/**
 * Vuex store
 * @type {Store}
 */
const store = new Vuex.Store({
  modules,
  state,
  mutations,
  actions,
  getters,
  strict: IS_DEV,
  plugins,
});

export default store;
