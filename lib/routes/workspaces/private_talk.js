'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/workspaces/{workspaceId}/private-talk',
  options: {
    tags: ['api', 'workspaces'],
    description: 'Start private talk',
    validate: {
      payload: Joi.object({
        users: Joi.array().items(Joi.string().uuid()).required()
      }).description('Private talk details').label('StartPrivateTalkDetails')
    }
  },
  handler: async (request, h) => {
    const { workspaceService } = request.services();
    const { userId } = request.auth.credentials;
    const { workspaceId } = request.params;
    const { users } = request.payload;

    if (!users.length) {
      return Boom.badRequest('Choose users for private talk');
    }
    
    try {
      await workspaceService.startPrivateTalk(workspaceId, userId, users);
      return 'ok';
    } catch (e) {
      if (e.message.includes('UsersInDifferentWorkspaces')) {
        return Boom.badRequest('Not all users are in the same workspace');
      } else if (e.message.includes('NotFound')) {
        return Boom.notFound('WorkspaceNotFound');
      } else if (e.message.includes('UsersNotExist')) {
        return Boom.badRequest('Can\'t find all users');
      }
      request.log(['debug-error'], 'Error on start private talk: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
