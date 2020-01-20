'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/workspace/{workspaceId}/channels',
  options: {
    tags: ['api', 'workspaces'],
    description: 'Creating channels in a certain workspace',
    validate: {
      payload: Joi.object({
        name: Joi.string().required().min(3).max(100)
      }).description('Workspace info').label('CreatingChannelInfo')
    }
  },
  handler: async (request, h) => {
    const { name } = request.payload;
    const { workspaceService, displayService } = request.services();
    const { userId } = request.auth.credentials;
    const { workspaceId } = request.params.workspaceId;
    
    try {
      const canCreateChannel = await workspaceService.canCreateChannel(workspaceId, userId );
      if (!canCreateChannel) {
        return Boom.unauthorized();
      }

      const workspace = await workspaceService.createChannel({ workspaceId, name, userId }, name);

      return {
        workspace: displayService.workspace(workspace)
      };
    } catch (e) {
      request.log(['debug-error'], 'Error create workspace: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
