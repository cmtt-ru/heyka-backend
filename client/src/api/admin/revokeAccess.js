import axios from 'axios';

/**
 * Revoke user's session
 * @param {string} workspaceId – workspace id
 * @param {string} userId – user id
 * @returns {string} result data
 */
export default function ({ workspaceId, userId }) {
  return axios.post('/admin/workspaces/revoke-access', {
    workspaceId,
    userId,
  }).then(res => res.data);
}
