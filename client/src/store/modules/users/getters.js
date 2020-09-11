import { getUserAvatarUrl } from '@libs/image';

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

  /**
   * Get user avatar url
   *
   * @param {UserState} state - user module state
   * @returns {function(*): User}
   */
  getUserAvatarUrl: state => (id, size) => {
    const user = state.collection[id];

    if (!user) {
      return null;
    }

    return getUserAvatarUrl(user, size);
  },
};
