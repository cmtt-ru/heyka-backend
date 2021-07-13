'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');
const errorMessages = require('../../error_messages');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/statistics/workspace',
  options: {
    tags: ['api', 'dashboard'],
    description: 'Get average and median count of channels in workspace',
    response: {
      status: {
        200: Joi.object({
          average: Joi.number(),
          median: Joi.number().integer().min(0),
        }).label('Workspace statistics details'),
        403: Joi.any().example(Boom.forbidden(errorMessages.accessDenied).output.payload)
          .description('User hasn\'t access to the statistics')
      },
      failAction: 'error',
    }
  },
  handler: async (request, h) => {
    const {
      workspaceService: ws,
    } = request.services();

    try {
      return ws.getWorkspaceStatistics();
    } catch (e) {
      request.log(['debug-error'], 'Error on get workspace statistics: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
