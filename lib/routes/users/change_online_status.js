'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');
const eventNames = require('../../socket/event_names');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/user/online-status',
  options: {
    tags: ['api', 'users'],
    description: 'Change online status of the user',
    validate: {
      payload: Joi.object({
        onlineStatus: Joi.string().allow('online', 'offline', 'idle').required()
      }).label('UserOnlineStatus'),
      query: Joi.object({
        socketId: Joi.string().required()
      })
    }
  },
  handler: async (request, h) => {
    const {
      userDatabaseService: udb
    } = request.services();
    const { userId } = request.auth.credentials;
    const { socketId } = request.query;
    const { onlineStatus } = request.payload;

    try {
      const workspaceForSocket = await udb.getWorkspaceForSocket(socketId);
      if (!workspaceForSocket) {
        return Boom.badRequest('Socket not found');
      }
      await udb.setOnlineStatus(userId, workspaceForSocket, onlineStatus);

      // notify about new online status
      request.server.apiEvents.emit('api-event', {
        room: eventNames.rooms.workspaceRoom(workspaceForSocket),
        name: eventNames.socket.onlineStatusChanged,
        data: {
          userId,
          onlineStatus
        }
      });

      return 'ok';
    } catch (e) {
      request.log(['debug-error'], 'Error on updating user online status: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
