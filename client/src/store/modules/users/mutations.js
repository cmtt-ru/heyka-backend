export default {
  /**
   * Replace full collection
   *
   * @param {UserState} state – user module state
   * @param {UserCollection} collection — user collection object
   * @constructor
   */
  SET_COLLECTION(state, collection) {
    state.collection = collection;
  },

  /**
   * Update specific user
   *
   * @param {UserState} state – user module state
   * @param {object} data — online status object
   * @param {string} data.id – user id
   * @constructor
   */
  UPDATE_USER(state, data) {
    if (state.collection[data.id]) {
      state.collection[data.id] = Object.assign(state.collection[data.id], data);
    }
  },
};
