import axios from 'axios';
import { clearTokens } from '../tokens';

/**
 * Verify email by triggering this API with JWT in email
 *
 * @param {object} params - params
 *  @param {string} params.password - password
 *
 * @returns {string} result data
 */
export default async function (params) {
  const res = await axios.post(`/me/delete`, params);

  clearTokens();

  return res;
}
