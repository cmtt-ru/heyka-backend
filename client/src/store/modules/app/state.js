import { heykaStore } from '@/store/localStore';

/**
 * @typedef {object} AppState
 * @property {string} language – language
 *
 * @property {object} devices – list of user devices
 * @property {boolean} devices.speakers – speakers
 * @property {boolean} devices.microphones – microphones
 * @property {boolean} devices.cameras – web cameras
 *
 * @property {object} selectedDevices – list of selected devices
 * @property {string} selectedDevices.speaker – selected speaker
 * @property {string} selectedDevices.microphone – selected microphone
 * @property {string} selectedDevices.camera – selected camera
 *
 * @property {object} socket – current socket parameters
 * @property {string} socket.id – id
 * @property {number} socket.connectedAt – last time when socket was connected
 *
 * @property {number} microphoneVolume – current microphone volume in decibels
 * @property {array} notifications – in-app notifications
 */

/**
 * App state
 * @returns {AppState}
 */
const state = () => {
  /**
   * @namespace AppState
   */
  return {
    language: heykaStore.get('language', 'en'),
    devices: {
      speakers: [],
      microphones: [],
      cameras: [],
    },
    selectedDevices: {
      speaker: null,
      microphone: null,
      camera: null,
    },
    microphoneVolume: -100,
    notifications: [],
    socket: {
      id: '',
      connectedAt: 0,
    },
  };
};

export default state();