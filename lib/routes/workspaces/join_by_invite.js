'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/join/{code}',
  options: {
    tags: ['api', 'workspaces'],
    description: 'Join to the workspace by an invite code',
    validate: {
      params: Joi.object({
        code: Joi.string().required().length(82).regex(/^[0-9a-f]{82}$/i)
      })
    }
  },
  handler: async (request, h) => {
    const {
      workspaceService,
      displayService,
      workspaceDatabaseService: wdb
    } = request.services();
    const { userId } = request.auth.credentials;
    const { code } = request.params;
    
    try {
      const codeInfo = await workspaceService.getInviteInfo(code);
      const isNotValid = codeInfo.status === 'NotFound'
        || codeInfo.status === 'Expired'
        || codeInfo.status === 'NotMatched';
      
      if (isNotValid) {
        return Boom.badRequest('InvalidCode');
      }

      await workspaceService.addUserToWorkspace(
        codeInfo.workspace.id,
        userId,
        wdb.roles().user
      );

      return {
        workspace: displayService.workspace(codeInfo.workspace)
      };
    } catch (e) {
      request.log(['debug-error'], 'Error on join user to workspace: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
