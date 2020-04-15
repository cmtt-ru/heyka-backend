'use strict';

const errorMessages = {
  // Universal error message for access denied situation
  accessDenied: 'Access denied',

  // Leave channel
  activeConversation: 'Active conversation',
  
  // Unselect channel
  channelNotSelected: 'Channel not selected',
  channelSelectedByAnotherDevice: 'Channel selected by another device',

  // Auth by link
  authLinkInvalid: 'Auth link is not valid',

  // Change online status
  socketNotFound: 'Socket not found'
};

module.exports = errorMessages;
