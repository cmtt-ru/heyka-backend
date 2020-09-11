import axios from 'axios';

/**
 * Verify email by triggering this API with JWT in email
 *
 * @param {string} jwt - json web token
 *
 * @returns {string} result data
 */
export default function (jwt) {
  return axios.get(`/verify/${jwt}`).then(res => res.data);
}
