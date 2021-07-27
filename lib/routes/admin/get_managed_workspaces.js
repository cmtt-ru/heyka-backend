'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const schemas = require('../../schemas');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/admin/managed-workspaces',
  options: {
    tags: ['api', 'admin'],
    description: 'Get list of workspaces that you can manage',
    response: {
      status: {
        200: Joi.array().items(schemas.workspace).label('WorkspaceList'),
      },
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

      return workspaces.filter(w => w.role === 'admin').map(item => displayService.workspace(item));
    } catch (e) {
      request.log(['debug-error'], 'Error on get list of my managed workspaces' + e + e.stack);
      return Boom.internal();
    }
  }
});
