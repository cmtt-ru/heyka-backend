'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/workspaces/create',
  options: {
    validate: {
      payload: {
        name: Joi.string().required()
      }
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
      request.log(['debug-error'], 'Error create workspace: ' + e);
      return Boom.internal();
    }
  }
});
