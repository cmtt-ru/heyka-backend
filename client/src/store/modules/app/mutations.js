/**
 * Max length of privacy log array
 * @type {number}
 */
export default {
  /**
   * Set app language
   *
   * @param {AppState} state – module app state
   * @param {string} language – new language identifier
   * @constructor
   */
  SET_LANGUAGE(state, language) {
    state.language = language;
  },

  /**
   * Add new notification
   *
   * @param {AppState} state – module app state
   * @param {object} notif – new notification
   * @constructor
   */
  ADD_NOTIFICATION(state, notif) {
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

  /**
   * Set device list
   *
   * @param {AppState} state – module app state
   * @param {object} devices – list of devices
   * @constructor
   */
  SET_DEVICES(state, devices) {
    state.devices = devices;

    // if (!state.selectedDevices.camera && devices.cameras.length > 0) {
    // state.selectedDevices.camera = devices.cameras[0].id;
    // }
  },

  /**
   * Set selected devices
   *
   * @param {AppState} state – module app state
   * @param {object} devices – list of selected devices
   * @constructor
   */
  SET_SELECTED_DEVICES(state, devices) {
    state.selectedDevices = devices;
  },

  /**
   * Set microphone volume
   *
   * @param {AppState} state – module app state
   * @param {number} volume – new microphone volume
   * @constructor
   */
  SET_MICROPHONE_VOLUME(state, volume) {
    state.microphoneVolume = volume;
  },

  /**
   * Set current socket parameters
   *
   * @param {AppState} state – module app state
   * @param {object} value – new parameters
   * @param {string} value.id – id
   * @param {number} value.connectedAt – last connected time
   * @constructor
   */
  SET_SOCKET_ID(state, value) {
    state.socket.id = value.id;
    state.socket.connectedAt = value.connectedAt;
  },
};
