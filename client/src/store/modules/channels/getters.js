export default {
  /**
   * Get channel by id
   *
   * @param {ChannelState} state – channels module state
   * @returns {object}
   */
  getChannelById: state => id => {
    return state.collection[id];
  },

  /**
   * Get first channel
   *
   * @param {ChannelState} state – channels module state
   * @returns {object}
   */
  getFirstChannel(state) {
    const channelId = Object.keys(state.collection)[0];

    return state.collection[channelId];
  },
};
