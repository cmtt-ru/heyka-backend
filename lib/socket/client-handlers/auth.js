'use strict';
const Joi = require('@hapi/joi');
const helpers = require('../helpers');
const eventName = require('../event_names').client.auth;
const eventNames = require('../event_names');
const dataSchema = Joi.object({
  transaction: Joi.string().optional(),
  token: Joi.string().uuid().required()
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
    if (dataSchema.validate(data).error) {
      return helpers.handleError(eventName, socket, data, 'Invalid data format for "auth" event');
    }

    const tokenValidation = await userService.isTokenValid(data.token);
    
    // Token doesnt exist
    if (!tokenValidation.result && tokenValidation.cause === 'NotFound') {
      return helpers.handleError(eventName, socket, data, 'Invalid access token');

    // Token is expired
    } else if (!tokenValidation.result && tokenValidation.cause === 'Expired') {
      return helpers.handleError(eventName, socket, data, 'Invalid access token');

    // Token is found
    } else if (tokenValidation.result) {
      // Link that socketId with user
      socket.userId = tokenValidation.tokenInfo.userId;
      socket.userSocketsStorage.addSocketForUser(tokenValidation.tokenInfo.userId, socket.id);

      // send success message
      socket.emit(eventNames.socket.authSuccess, {
        userId: tokenValidation.tokenInfo.userId,
        transaction: data.transaction
      });

    // Impossible situation
    } else {
      socket.server.log(['error', 'warn'], 'Error on token validation (socket)' + JSON.stringify(data));
    }
  };
};
