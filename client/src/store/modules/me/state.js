/**
 * @typedef {object} MeState
 * @property {string} id – my id
 * @property {string} selectedWorkspaceId – selected workspace id
 * @property {string} selectedChannelId – selected channel id
 * @property {MediaState} mediaState – my media state
 * @property {boolean} allowDraw – Allow/forbid drawing
 */

/**
 * Me state
 * @returns {MeState}
 */
const state = () => {
  /**
   * @type MediaState
   */
  const initialMediaState = {
    microphone: false,
    speakers: true,
    screen: false,
    camera: false,
    speaking: false,
  };

  /**
   * @namespace MeState
   */
  return {
    id: null,
    selectedWorkspaceId: null,
    selectedChannelId: null,
    mediaState: initialMediaState,
    previousMediaState: initialMediaState,
    allowDraw: true,
  };
};

export default state();
