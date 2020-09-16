import axios from 'axios';

/**
 * Create new workspace
 *
 * @param {object} params - invite code
 * @param {string} params.avatarFileId - workspace avatar
 * @param {string} params.name - workspace name
 * @returns {string}
 */
export default async function (params) {
  const res = await axios.post(`/workspaces`, params);

  return res.data;
}
