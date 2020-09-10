import axios from 'axios';

/**
 * Reset password
 *
 * @param {object} params - params
 *  @param {string} params.token - json web token
 *  @param {string} params.password - password
 *
 * @returns {string} auth link
 */
export default function (params) {
  return axios.post('/reset-password', params).then(res => res.data);
}
