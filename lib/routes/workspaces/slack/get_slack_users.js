'use strict';

const Helpers = require('../../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/workspaces/{workspaceId}/slack/users',
  options: {
    tags: ['api', 'workspaces'],
    description: 'Get slack users for the workspace',
    validate: {
      params: Joi.object({
        workspaceId: Joi.string().uuid().required()
      })
    },
  },
  handler: async (request, h) => {
    const { 
      workspaceDatabaseService: wdb,
      slackService,
      permissionService,
      workspaceService
    } = request.services();
    const { workspaceId } = request.params;
    const { userId } = request.auth.credentials;
    
    try {
      const isAllowed = await permissionService.canGetSlackUsersWorkspace(workspaceId, userId);
      if (!isAllowed) {
        return Boom.forbidden();
      }

      const workspace = await wdb.getWorkspaceById(workspaceId);
      
      if (!workspace.slack.access_token) {
        return Boom.badRequest('SlackNotConnected');
      }

      try{
        const users = await slackService.getSlackWorkspaceUserList(workspace.slack.team.id,
          workspace.slack.access_token);
        return users
          .filter(u => !u.is_bot && !u.deleted && u.name !== 'slackbot')
          .map(u => ({
            id: u.id,
            name: u.name,
            realName: u.real_name,
            avatar32: u.profile.image_32,
            avatar72: u.profile.image_72,
            avatarOriginal: u.profile.image_original,
          }));
      } catch(err){
        console.log('SLACK CONNECTION ERR>>>>>>>>>>>>>>>>>', err);
        await workspaceService.detachSlack(workspaceId);
        return Boom.badRequest('SlackNotConnected');
      }

    } catch (e) {
      request.log(['debug-error'], 'Error gettings users from slack: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
