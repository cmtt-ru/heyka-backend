import axios from 'axios';

/**
 * Check connection
 * @returns {string} result data
 */
export default function ({ workspaceId, userId }) {
  return axios.post('/admin/workspaces/revoke-access', {
    workspaceId,
    userId,
  }).then(res => res.data);
}
