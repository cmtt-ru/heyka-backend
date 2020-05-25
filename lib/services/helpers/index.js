'use strict';
const crypto = require('crypto-promise');

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
 * Return random string with the specified length
 */
exports.getRandomCode = async (length) => {
  return (await crypto.randomBytes(Math.ceil(length * 0.5))).toString('hex').slice(0, length);
};

/**
 * Return secure random number
 */
exports.getSecureRandomNumber = async () => {
  return parseInt((await crypto.randomBytes(6)).toString('hex'), 16);
};
