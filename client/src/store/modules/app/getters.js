import i18n from '@/i18n';

export default {
  /**
   * Get devices
   *
   * @param {AppState} state – module app state
   * @returns {string}
   */
  getDevices: (state) => {
    const devices = {};
    const defaultLabel = i18n.t('settings.devices.defaultDevice');

    Object.keys(state.devices).forEach((key) => {
      devices[key] = state.devices[key].map(d => {
        return {
          name: d.label === 'Default' ? defaultLabel : d.label,
          value: d.id,
        };
      });
    });

    return devices;
  },

  /**
   * Get selected devices
   *
   * @param {AppState} state – module app state
   * @returns {object}
   */
  getSelectedDevices: (state) => state.selectedDevices,

  /**
   * Get mic volume
   *
   * @param {AppState} state – module app state
   * @returns {object}
   */
  getMicrophoneVolume: (state) => state.microphoneVolume,
};
