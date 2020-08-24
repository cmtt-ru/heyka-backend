export default {
  /**
   * Get user info by his id
   *
   * @param {UserState} state – user module state
   * @returns {function(*): User}
   */
  getUserById: state => id => {
    return state.collection[id] || null;
  },
};
