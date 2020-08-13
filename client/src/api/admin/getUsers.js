import axios from 'axios';

/**
 * Check connection
 * @returns {string} result data
 */
export default function (workspaceId) {
  return axios.get(`/admin/workspaces/${workspaceId}/users`).then(res => res.data);
}
