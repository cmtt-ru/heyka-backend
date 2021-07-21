'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const schemas = require('../../schemas');
const errorMessages = require('../../error_messages');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/workspaces/{workspaceId}/private-talk',
  options: {
    tags: ['api', 'workspaces'],
    description: 'Start private talk',
    validate: {
      payload: Joi.object({
        users: Joi.array().items(Joi.string().uuid()).required()
      }).description('Private talk details').label('StartPrivateTalkDetails'),
    },
    response: {
      schema: Joi.object({
        channel: schemas.channel
      }),
      failAction: 'error'
    }
  },
  handler: async (request, h) => {
    const { workspaceService, displayService } = request.services();
    const { userId } = request.auth.credentials;
    const { workspaceId } = request.params;
    const { users } = request.payload;

    if (!users.length) {
      return Boom.badRequest('Choose users for private talk');
    }
    
    try {
      const channelInfo = await workspaceService.startPrivateTalk(workspaceId, userId, users);
      return {
        channel: displayService.channel(channelInfo)
      };
    } catch (e) {
      if (e.message.includes('UsersInDifferentWorkspaces')) {
        return Boom.badRequest('Not all users are in the same workspace');
      }
      else if (e.message.includes('NotFound')) {
        return Boom.notFound('WorkspaceNotFound');
      }
      else if (e.message.includes('UsersNotExist')) {
        return Boom.badRequest('Can\'t find all users');
      }
      if (e.message === 'There are no members in the workspace') {
        return Boom.notFound(errorMessages.membersNotFound);
      }
      else if (e.message === 'Too many members in the channel') {
        return Boom.badRequest(errorMessages.limitExceeded);
      }
      request.log(['debug-error'], 'Error on start private talk: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
