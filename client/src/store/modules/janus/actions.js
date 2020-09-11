import sleep from 'es7-sleep';

export default {
  /**
   * Set sharing source id
   *
   * @param {function} commit – store commit
   * @param {object} source – source
   * @returns {void}
   */
  setSharingSource({ commit }, source) {
    commit('SET_SHARING_SOURCE', source);
  },

  /**
   * Set inProgress flag
   * @param {function} commit – store commit
   * @param {boolean} state – progress state
   * @returns {void}
   */
  setInProgress({ commit }, state) {
    commit('SET_IN_PROGRESS', state);
  },

  /**
   * Wait until janus finishes operations
   * @param {JanusState} state – progress state
   * @returns {void}
   */
  async untilIdle({ state }) {
    const timeout = 50;

    while (state.inProgress) {
      await sleep(timeout);
    }
  },
};
