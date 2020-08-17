import Vue from 'vue';
import Vuex from 'vuex';
import { v4 as uuidV4 } from 'uuid';

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    /** Notification array **/
    notifications: [],
  },

  mutations: {
    /**
   * Add new notification
   *
   * @param {AppState} state – module app state
   * @param {object} notif – new notification
   * @constructor
   */
    ADD_NOTIFICATION(state, notif) {
      console.log(notif);
      state.notifications.push(notif);
    },

    /**
   * Remove notification by id
   *
   * @param {AppState} state – module app state
   * @param {string} id id
   * @constructor
   */
    REMOVE_NOTIFICATION(state, id) {
      state.notifications = state.notifications.filter(el => el.id != id);
    },
  },

  actions: {
  /**
   * Add new in-app notification
   *
   * @param {function} commit – store commit
   * @param {object} notif – notification
   * @returns {string} id
   */
    addNotification({ commit }, notif) {
      const id = uuidV4();
      const notification = {
        id,
        ...notif,
      };

      commit('ADD_NOTIFICATION', notification);

      return id;
    },

    /**
   * Remove in-app notification by ID
   *
   * @param {function} commit – store commit
   * @param {string} id – notification id
   * @returns {void}
   */
    removeNotification({ commit }, id) {
      commit('REMOVE_NOTIFICATION', id);
    },
  },

  modules: {
  },
});
