'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/workspaces',
  options: {
    tags: ['api', 'workspaces'],
    description: 'Creating workspaces',
    validate: {
      payload: Joi.object({
        name: Joi.string().required().min(3).max(100),
      }).description('Workspace info').label('CreatingWorkspaceInfo')
    }
  },
  handler: async (request, h) => {
    const { name } = request.payload;
    const { workspaceService, displayService } = request.services();
    const { userId } = request.auth.credentials;
    
    try {
      const workspace = await workspaceService.createWorkspace({ id: userId }, name);

      return {
        workspace: displayService.workspace(workspace)
      };
    } catch (e) {
      request.log(['debug-error'], 'Error create workspace: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
