import axios from 'axios';
import { setTokens } from '../tokens';

/**
 * Join channel with invite token
 * @param {string} token - invite token
 * @param {string} params - params
 * @param {string} params.name - temp user name
 * @returns {string} 'ok'
 */
export default async function (token, params) {
  const res = await axios.post(`/channels/join/${token}`, params);

  setTokens(res.data.credentials, false);

  return res.data;
}
