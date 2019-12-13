'use strict';
const Joi = require('@hapi/joi');
const helpers = require('../helpers');
const eventName = require('../event_names').client.auth;
const eventNames = require('../event_names');
const dataSchema = Joi.object({
  transaction: Joi.string().optional(),
  data: Joi.string().uuid().required()
});

/**
 * Returns handler-function for "auth" event from client
 * 
 * 1. Checks access token
 * 2. Joins the socket to certain rooms
 * 3. Links socket and user id in Redis
 */
module.exports = (socket) => {
  return async function authHandler (data) {
    const { userService } = socket.server.services();

    // validate input data
    if (!dataSchema.validate(data)) {
      return helpers.handleError(eventName, socket, data, 'Invalid data format for "auth" event');
    }

    // find and validate access token
    const token = await userService.findAccessToken(data.token);
    if (!token || !token.expired || Date.now() > token.expired) {
      return helpers.handleError(eventName, socket, data, 'Invalid access token');
    }

    // send success message
    socket.emit(eventNames.socket.authSuccess, { userId: token.userId });
  };
};
