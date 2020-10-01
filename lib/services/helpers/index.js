'use strict';
const crypto = require('crypto-promise');
const vanillaCrypto = require('crypto');

/**
 * Add timestamp fields to the object
 */
exports.withTimestamp = (object, timestamp) => ({
  ...object,
  updated_at: timestamp,
  created_at: timestamp
});

/**
 * Convert id and code to url full code
 * For example, there are email verification codes.
 * Each code has id and code. id = 0a107634-85b8-47f9-8faf-540313c087ef,
 * code = 74b02c47c780506844977bec257674f36e86482946dbe4ab26
 * So, full code will be "0a10763485b847f98faf540313c087ef" (id without dashes)
 * plus code
 */
exports.codeConvertToUrl = (id, code) => {
  return id.replace(/-/g, '') + code;
};
exports.urlConvertToCode = (fullCode) => {
  let id = fullCode.substr(0, 32);
  id = `${id.slice(0,8)}-${id.slice(8,12)}`
    + `-${id.slice(12,16)}-${id.slice(16, 20)}`
    + `-${id.slice(20,32)}`;
  const code = fullCode.substr(32, 50);
  return { id, code };
};

/**
 * @deprecated
 * Return random string with the specified length
 */
exports.getRandomCode = async (length) => {
  return (await crypto.randomBytes(Math.ceil(length * 0.5))).toString('hex').slice(0, length);
};
/**
 * Generates random string with specified length
 * @param {number} length String length 
 * @returns {string}
 */
exports.generateRandomString = async (length) => {
  return (await crypto.randomBytes(length)).toString('base64').replace(/\W/g, '').substring(0, 12);
};

/**
 * Return secure random number
 */
exports.getSecureRandomNumber = async () => {
  return parseInt((await crypto.randomBytes(6)).toString('hex'), 16);
};

/**
 * Compiles channel name for private talk
 * depending on user names
 * 
 * @typedef {object} WithNames
 * @property {string} id
 * @property {string} name Name property for object
 * @param {Array<WithNames>} users Users objects
 * @param {string} firstUserId User id of first user in name
 * @returns {string} New private channel name
 */
exports.compilePrivateChannelName = (users, firstUserId) => {
  if (firstUserId) {
    users.sort((a, b) => a.id === firstUserId ? -1 : 1);
  }
  return users.reduce(
    (prev, curr, index) => `${prev}${index > 0 ? ', ' : ''}${curr.name.split(' ')[0]}`, ''
  );
};

exports.getGravatarUrl = (email) => {
  const hash = vanillaCrypto.createHash('md5').update(email).digest('hex');
  return `https://gravatar.com/avatar/${hash}?d=retro`;
};
