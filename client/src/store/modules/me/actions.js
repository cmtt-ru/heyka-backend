import API from '@api';

export default {
  /**
   * Set selected workspace id
   *
   * @param {function} commit – store commit
   * @param {string} id – workspace id
   * @returns {void}
   */
  setSelectedWorkspaceId({ commit }, id) {
    commit('SET_WORKSPACE_ID', id);
  },

  /**
   * Set our new media state
   *
   * @param {function} commit – store commit
   * @param {MediaState} mediaState – new mediaState
   * @param {function} getters – store getters
   * @param {MeState} state – state
   * @param {function} dispatch – dispatch action
   * @returns {void}
   */
  async setMediaState({ commit, getters, state, dispatch }, mediaState) {
    const selectedChannelId = getters['getSelectedChannelId'];

    /**
     * User is trying to share camera and screen at the same time
     */
    if (mediaState.camera === true && mediaState.screen === true) {
      /** If user is already sharing camera, than disable it */
      if (state.mediaState.camera === true) {
        mediaState.camera = false;
      }

      /** If user is already sharing screen, than disable it */
      if (state.mediaState.screen === true) {
        dispatch('janus/setSharingSource', null, { root: true });
        mediaState.screen = false;
      }

      const newState = {
        ...state.mediaState,
        camera: false,
        screen: false,
      };

      /** Set media state of camera & screen to false */
      commit('SET_MEDIA_STATE', newState);

      if (selectedChannelId) {
        await API.user.setMediaState(newState);
      }

      await dispatch('janus/untilIdle', null, { root: true });
    } else if (mediaState.screen === false && state.mediaState.screen === true) {
      dispatch('janus/setSharingSource', null, { root: true });
    }

    /**
     * Speaker on / off & Microphone mute / unmute logic
     */
    if (state.mediaState.speakers !== mediaState.speakers) {
      /** If user going to off speakers than mute microphone */
      if (mediaState.speakers === false) {
        mediaState.microphone = false;
        commit('SET_PREVIOUS_STATE', state.mediaState);
      }

      /** If user going to on speakers than set microphone to previous state*/
      if (mediaState.speakers === true) {
        mediaState.microphone = state.previousMediaState.microphone;
      }
    }

    /**
     * If microphone goes unmute, than on speakers
     */
    if (mediaState.microphone && !state.mediaState.speakers) {
      mediaState.speakers = true;
    }

    commit('SET_MEDIA_STATE', mediaState);

    if (selectedChannelId) {
      await API.user.setMediaState(mediaState);
    }
  },

  /**
   * Set default media state
   *
   * @param {function} commit – store commit
   * @param {MeState} state – state
   * @returns {void}
   */
  async setDefaultMediaState({ commit, state }) {
    const defaultState = {
      ...state.mediaState,
      microphone: false,
      camera: false,
      screen: false,
      speakers: true,
      speaking: false,
    };

    commit('SET_MEDIA_STATE', defaultState);
  },

  /**
   * Stop all media sharing
   *
   * @param {function} commit – store commit
   * @param {MeState} state – state
   * @param {function} dispatch – dispatch action
   * @returns {void}
   */
  async stopMediaSharing({ commit, state, dispatch }) {
    dispatch('janus/setSharingSource', null, { root: true });

    dispatch('setMediaState', {
      ...state.mediaState,
      camera: false,
      screen: false,
    });
  },

  /**
   * Change microphone state
   * @param {MeState} state – vuex state
   * @param {boolean} micState – microphone state
   * @param {function} dispatch – vuex dispatch
   * @returns {void}
   */
  microphoneState({ state, dispatch }, micState) {
    const newState = { ...state.mediaState };

    newState.microphone = micState;
    dispatch('setMediaState', newState);
  },

  /**
   * Muted by user
   * @param {function} dispatch – vuex dispatch
   * @param {boolean} userId – microphone state
   * @returns {void}
   */
  async mutedByUser({ dispatch }, userId) {
    dispatch('microphoneState', false);
  },
};
