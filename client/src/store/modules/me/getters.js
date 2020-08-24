export default {
  /**
   * Get user id
   *
   * @param {MeState} state – module me state
   * @returns {string}
   */
  getMyId(state) {
    return state.id;
  },

  /**
   * Get selected workspace id
   *
   * @param {MeState} state – me module state
   * @returns {string}
   */
  getSelectedWorkspaceId: state => {
    return state.selectedWorkspaceId;
  },

  /**
   * Get media state
   *
   * @param {MeState} state – me module state
   * @returns {object}
   */
  getMediaState: state => {
    return state.mediaState;
  },

  /**
   * Get selected channel id
   *
   * @param {MeState} state – me module state
   * @returns {string}
   */
  getSelectedChannelId: state => {
    return state.selectedChannelId;
  },

  /**
   * Get drawing allow state
   *
   * @param {MeState} state – me module state
   * @returns {string}
   */
  getAllowDraw: state => {
    return state.allowDraw;
  },
};
