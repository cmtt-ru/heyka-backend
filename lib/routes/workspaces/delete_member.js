'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');

module.exports = Helpers.withDefaults({
  method: 'DELETE',
  path: '/workspaces/{workspaceId}/members/{userId}',
  options: {
    tags: ['api', 'workspaces'],
    description: 'Delete member from workspace',
    validate: {
      params: Joi.object({
        workspaceId: Joi.string().uuid().required(),
        userId: Joi.string().uuid().required(),
      }),
    },
    response: {
      status: {
        200: Joi.allow('ok'),
        403: Joi.any()
          .description('User can not manage member list'),
      }
    }
  },
  handler: async (request, h) => {
    const { userId } = request.auth.credentials;
    const { workspaceId, userId: memberId } = request.params;
    const {
      workspaceService,
      permissionService,
    } = request.services();

    try {
      const permitted = await permissionService.canUpdateWorkspace(workspaceId, userId);
      
      if (!permitted) {
        return Boom.forbidden();
      }

      await workspaceService.kickUserFromWorkspace(workspaceId, memberId);

      return 'ok';
    } catch (e) {
      if (e.message === 'NotFound') {
        return Boom.notFound('WorkspaceNotFound');
      } else if (e.message === 'CantKickCreator') {
        return Boom.forbidden('Cannot kick workspace creator');
      }
      request.log(['debug-error'], 'Error on delete workpsace member: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
