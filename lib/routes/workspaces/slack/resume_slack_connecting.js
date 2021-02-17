'use strict';

const Helpers = require('../../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/workspaces/slack/connect/resume',
  options: {
    auth: false,
    tags: ['api', 'workspaces'],
    description: 'Resume connecting slack (redirect from slack)',
    response: {
      failAction: 'error',
      status: {
        200: Joi.object({
          slackWorkspaceName: Joi.string().required(),
          workspaceName: Joi.string().required(),
        })
      }
    }
  },
  handler: async (request, h) => {
    const {
      workspaceService,
    } = request.services();
    const { code, state, error } = request.query;
    
    if (error) {
      return Boom.badRequest('SlackError');
    }

    if (!code || !state) {
      return Boom.badRequest('"code" and "state" is required in query parameters');
    }
    
    try {
      const result = await workspaceService.finishSlackConnecting(state, code);

      return result;
    } catch (e) {
      if (e.message.includes('OperationNotFound')) {
        return Boom.badRequest('InvalidSlackState');
      }
      request.log(['debug-error'], 'Error on resuming to connect slack: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
