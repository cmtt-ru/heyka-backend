'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');

module.exports = Helpers.withDefaults({
  method: 'DELETE',
  path: '/workspaces/{workspaceId}',
  options: {
    tags: ['api', 'workspaces'],
    description: 'Delete workspace',
    validate: {
      payload: Joi.object({
        name: Joi.string().required(),
      }),
    },
  },
  handler: async (request, h) => {
    const {
      workspaceService,
      permissionService,
    } = request.services();
    const { userId } = request.auth.credentials;
    const { workspaceId } = request.params;
    const { name } = request.payload;
    
    try {
      const canDeleteWorkspace = await permissionService.canDeleteWorkspace(workspaceId, userId);
      if (!canDeleteWorkspace) {
        return Boom.forbidden();
      }

      await workspaceService.deleteWorkspace(workspaceId, name);

      return 'ok';
    } catch (e) {
      if (e.message === 'NotFound') {
        return Boom.notFound();
      } else if (e.message === 'InvalidName') {
        return Boom.badRequest('Wrong name');
      }
      request.log(['debug-error'], 'Error delete workspace: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
