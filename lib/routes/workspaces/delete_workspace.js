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
  },
  handler: async (request, h) => {
    const {
      workspaceService,
      permissionService,
    } = request.services();
    const { userId } = request.auth.credentials;
    const { workspaceId } = request.params;
    
    try {
      const canDeleteWorkspace = await permissionService.canDeleteWorkspace(workspaceId, userId);
      if (!canDeleteWorkspace) {
        return Boom.forbidden();
      }

      await workspaceService.deleteWorkspace(workspaceId);

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
