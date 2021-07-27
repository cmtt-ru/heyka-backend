'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const schemas = require('../../schemas');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/workspaces',
  options: {
    tags: ['api', 'workspaces'],
    description: 'Creating workspaces',
    validate: {
      payload: Joi.object({
        name: Joi.string().required().min(3).max(100),
        avatarFileId: Joi.string().uuid().optional(),
      }).description('Workspace info').label('CreatingWorkspaceInfo'),
    },
    response: {
      schema: Joi.object({
        workspace: schemas.workspaceForUser
      }).label('CreatedWorkspaceResponse'),
      failAction: 'log'
    }
  },
  handler: async (request, h) => {
    const { name, avatarFileId } = request.payload;
    const {
      workspaceService,
      displayService,
    } = request.services();
    const { userId } = request.auth.credentials;
    
    try {
      const {
        workspace,
        relation,
      } = await workspaceService.createNewWorkspace(userId, {
        name,
        avatarFileId,
      });

      return {
        workspace: displayService.workspaceForUser(workspace, relation)
      };
    } catch (e) {
      request.log(['debug-error'], 'Error create workspace: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
