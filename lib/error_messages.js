'use strict';

const errorMessages = {
  // Universal error messages
  accessTokenExpired: 'Access token is expired',
  accessDenied: 'Access denied',
  notFound: 'Not found',

  // Leave channel
  activeConversation: 'Active conversation',
  
  // Unselect channel
  channelNotSelected: 'Channel not selected',
  channelSelectedByAnotherDevice: 'Channel selected by another device',

  // Auth by link
  authLinkInvalid: 'Auth link is not valid',

  // Change online status
  socketNotFound: 'Socket not found',

  // Refresh token
  credentialsAreInvalid: 'Credentials are invalid',
  refreshTokenExpired: 'Refresh token is expired',

  // Sign in
  emailOrPasswordAreInvalid: 'Email or password are invalid',

  // Sign up
  emailExists: 'A user with that email address has already signed up',

  // Email verification
  verificationCodeIsNotValid: 'Verification code is not valid',

  // Upload an avatar
  mediaTypeNotSupported: 'Unsupported Media Type',
  downloadImageError: 'Cannot download image from url',
  fileNotFound: 'File is not found',

  // Send message
  userNotConnected: 'User is not connected',
  messageNotFound: 'Message not found',

  // Update media statae
  unknowConnection: 'Unknow socket connection',
  connectionNotInChannel: 'Socket connection not in a channel',

  // Mute for all
  notInChannel: 'Users are not in the same channel'
};

module.exports = errorMessages;
