'use strict';

exports.defaultUserState = defaultUserState;
exports.withAuthorization = withAuthorization;
exports.skipSomeTime = skipSomeTime;

/**
 * Returns object with default user media state
 */
function defaultUserState () {
  return {
    microphone: false,
    speakers: true,
    screen: false,
    camera: false,
    speaking: false
  };
}

/**
 * Returns headers for auth credentials
 * @param {object} tokens Auth credentials
 */
function withAuthorization (tokens) {
  return {
    headers: { Authorization: `Bearer ${tokens.accessToken}` }
  };
}

/**
 * Returns promise that resolves after given ms
 * @param {Number} ms Skip certain number
 * @returns {Promise<void>}
 */
async function skipSomeTime(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
