import axios from 'axios';

/**
 * Check connection
 * @returns {string} result data
 */
export default function () {
  return axios.get('/admin/managed-workspaces').then(res => res.data);
}
