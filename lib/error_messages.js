'use strict';

const errorMessages = {
  // Universal error messages
  accessTokenExpired: 'Access token is expired',
  accessDenied: 'Access denied',
  notFound: 'Not found',
  internalError: 'Internal error',

  // Leave channel
  activeConversation: 'Active conversation',

  // select channel
  channelAlreadySelected: 'Channel already selected',
  
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
  limitReached: 'The limit of uploaded files is reached',

  // Send message
  userNotConnected: 'User is not connected',
  messageNotFound: 'Message not found',

  // Update media statae
  unknowConnection: 'Unknow socket connection',
  connectionNotInChannel: 'Socket connection not in a channel',

  // update profile errors
  imageFileNotFound: 'Image file not found',
  haventAccessToFile: 'You have not access to the file',
  fileShouldBeAvatar: 'The provided file is not avatar',
  emailAlreadyInUse: 'The email address is already in use',

  // check permissions
  checkPermissionError: 'Bad data for checking permissions',

  // reset password
  tokenIsInvalid: 'Token is invalid',
  
  // Mute for all
  notInChannel: 'Users are not in the same channel',

  // social auth
  serviceAlreadyAttached: 'You have already attached an account from that external service',
  alreadyAttachedAnotherUser: 'That external account has been attached to another user',
  accountAlreadyAttached: 'You already attached that external account',
  serviceNotAttached: 'That external service is not attached',
  lastLoginMethod: 'Can\'t detach social account because it is the latest login method',

  // delete account
  invalidPassword: 'Invalid password',
  cannotDeleteAdminUser: 'You can not delete account while you have admin rights in at least one workspace',

  // User in channel
  userInChannel: 'User in channel',
  
  // limit for channel members
  limitExceeded: 'Too many members in the channel',
};

module.exports = errorMessages;
