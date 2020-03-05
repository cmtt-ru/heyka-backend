'use strict';

exports.defaultUserState = defaultUserState;
exports.withAuthorization = withAuthorization;

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
