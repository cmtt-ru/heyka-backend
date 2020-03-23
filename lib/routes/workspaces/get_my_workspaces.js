'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const schemas = require('../../schemas');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/workspaces',
  options: {
    tags: ['api', 'workspaces'],
    description: 'Get list of your own workspaces',
    response: {
      schema: Joi.array().items(schemas.workspace).label('GetMyWorkspacesResult'),
      failAction: 'error'
    }
  },
  handler: async (request, h) => {
    const {
      workspaceDatabaseService: wdb,
      displayService
    } = request.services();
    const { userId } = request.auth.credentials;
    
    try {
      const workspaces = await wdb.getWorkspacesByUserId(userId);

      return workspaces.map(item => displayService.workspace(item));
    } catch (e) {
      request.log(['debug-error'], 'Error on get list of my workspaces' + e + e.stack);
      return Boom.internal();
    }
  }
});