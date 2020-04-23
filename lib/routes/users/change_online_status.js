'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');
const errorMessages = require('../../error_messages');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/user/online-status',
  options: {
    tags: ['api', 'user'],
    description: 'Change online status of the user',
    validate: {
      payload: Joi.object({
        onlineStatus: Joi.string().allow('online', 'offline', 'idle').required()
      }).label('UserOnlineStatus'),
      query: Joi.object({
        socketId: Joi.string().required()
      })
    },
    response: {
      status: {
        200: Joi.valid('ok'),
        400: Joi.any().example(Boom.badRequest(errorMessages.socketNotFound).output.payload)
          .description('Socket with that id has not been connected to the server')
      }
    }
  },
  handler: async (request, h) => {
    const {
      userService,
      userDatabaseService: udb
    } = request.services();
    const { userId } = request.auth.credentials;
    const { socketId } = request.query;
    const { onlineStatus } = request.payload;

    try {
      const workspaceForSocket = await udb.getWorkspaceForSocket(socketId);
      if (!workspaceForSocket) {
        return Boom.badRequest(errorMessages.socketNotFound);
      }

      await userService.updateOnlineStatus(userId, workspaceForSocket, onlineStatus);

      return 'ok';
    } catch (e) {
      request.log(['debug-error'], 'Error on updating user online status: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
