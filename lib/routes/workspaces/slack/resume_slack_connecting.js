'use strict';

const Helpers = require('../../helpers');
const Boom = require('@hapi/boom');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/workspaces/slack/connect/resume',
  options: {
    auth: false,
    tags: ['api', 'workspaces'],
    description: 'Resume connecting slack (redirect from slack)'
  },
  handler: async (request, h) => {
    const { workspaceService } = request.services();
    const { code, state, error } = request.query;
    
    if (error) {
      return Boom.badRequest('SlackError');
    }

    if (!code || !state) {
      return Boom.badRequest('"code" and "state" is required in query parameters');
    }
    
    try {
      await workspaceService.finishSlackConnecting(state, code);
      return 'ok';
    } catch (e) {
      if (e.message.includes('OperationNotFound')) {
        return Boom.badRequest('InvalidSlackState');
      }
      request.log(['debug-error'], 'Error on resuming to connect slack: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
