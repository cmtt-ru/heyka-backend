'use strict';

const Helpers = require('../../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/workspaces/{workspaceId}/slack/connect',
  options: {
    tags: ['api', 'workspaces'],
    description: 'Initiate the process of connecting slack to heyka workspace',
    validate: {
      params: Joi.object({
        workspaceId: Joi.string().uuid().required()
      })
    }
  },
  handler: async (request, h) => {
    const { workspaceService, slackService } = request.services();
    const { workspaceId } = request.params;
    const { userId } = request.auth.credentials;
    
    try {
      const isAllowed = await workspaceService.canConnectSlack(workspaceId, userId);
      if (!isAllowed) {
        return Boom.unauthorized('UserCannotConnectSlack');
      }

      const slackState = await workspaceService.initiateSlackConnecting(workspaceId);
      const slackConnectingUrl = await slackService.getConnectingSlackUrl(slackState);
      return {
        redirect: slackConnectingUrl
      };
    } catch (e) {
      request.log(['debug-error'], 'Error on initiate slack connecting: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
