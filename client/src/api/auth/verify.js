import axios from 'axios';
import { setTokens } from '../tokens';

/**
 * Verify email by triggering this API with JWT in email
 *
 * @param {string} jwt - json web token
 *
 * @returns {string} result data
 */
export default async function (jwt) {
  const res = await axios.get(`/verify/${jwt}`);

  setTokens(res.data.credentials);

  return res.data;
}
