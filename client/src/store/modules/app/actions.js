import i18n from '@/i18n';
import { v4 as uuidV4 } from 'uuid';
import { heykaStore } from '@/store/localStore';

/**
 * @typedef PrivacyLogData
 * @property {string} category – category, e.g. API or SOCKET
 * @property {string} method – method name, e.g. getWorkspaces
 * @property {object} data – data sent, e.g. {userId: '...'}
 */

export default {
  /**
   * Set app language
   *
   * @param {function} commit – store commit
   * @param {string} language – app language
   * @returns {void}
   */
  setLanguage({ commit }, language) {
    commit('SET_LANGUAGE', language);
    i18n.locale = language;
    heykaStore.set('language', language);
  },

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
    commit('app/REMOVE_NOTIFICATION', id);
  },

  /**
   * Set selected devices
   *
   * @param {function} commit – store commit
   * @param {object} selectedDevices – selected devices
   * @returns {void}
   */
  setSelectedDevices({ commit }, selectedDevices) {
    commit('SET_SELECTED_DEVICES', selectedDevices);

    heykaStore.set('selectedSpeaker', selectedDevices.speaker);
    heykaStore.set('selectedMicrophone', selectedDevices.microphone);
    heykaStore.set('selectedCamera', selectedDevices.camera);
  },

  /**
   * Set microphone volume
   *
   * @param {function} commit – store commit
   * @param {number} volume – microphone volume
   * @returns {void}
   */
  setMicrophoneVolume({ commit }, volume) {
    const quietestVolume = -100;
    const loudestVolume = 0;

    if (volume < quietestVolume) {
      volume = quietestVolume;
    }

    if (volume > loudestVolume) {
      volume = loudestVolume;
    }

    commit('SET_MICROPHONE_VOLUME', volume);
  },
};
