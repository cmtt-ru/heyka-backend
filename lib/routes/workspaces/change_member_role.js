'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/workspaces/{workspaceId}/permissions',
  options: {
    tags: ['api', 'workspaces'],
    description: 'Change workspace member role',
    validate: {
      payload: Joi.object({
        userId: Joi.string().required().uuid(),
        role: Joi.string().valid('admin', 'user'),
      }),
      params: Joi.object({
        workspaceId: Joi.string().uuid().required(),
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
    const { workspaceId } = request.params;
    const { userId: memberId, role } = request.payload;
    const {
      workspaceService,
      permissionService,
    } = request.services();

    try {
      const permitted = await permissionService.canChangeRoleInWorkspace(workspaceId, userId);
      
      if (!permitted) {
        return Boom.forbidden();
      }

      await workspaceService.changeMemberRole(workspaceId, memberId, role);

      return 'ok';
    } catch (e) {
      if (e.message === 'NotFound') {
        return Boom.notFound('WorkspaceNotFound');
      } else if (e.message === 'CantDemoteCreator') {
        return Boom.forbidden('Cannot demote workspace creator');
      }
      request.log(['debug-error'], 'Error on change workspace member role: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
