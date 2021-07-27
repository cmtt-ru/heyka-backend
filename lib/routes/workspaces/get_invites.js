'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const schemas = require('../../schemas');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/workspaces/{workspaceId}/invites',
  options: {
    tags: ['api', 'workspaces'],
    description: 'Get list of all workspace invites',
    validate: {
      query: Joi.object({
        list: Joi.string().valid('my', 'all').default('my'),
      }),
    },
    response: {
      status: {
        200: Joi.array().items(schemas.invite).label('InviteList'),
      },
      failAction: 'log'
    }
  },
  handler: async (request, h) => {
    const { userId } = request.auth.credentials;
    const { workspaceId } = request.params;
    const { list } = request.query;
    const {
      permissionService,
      displayService,
      inviteCodesDatabaseService: invdb,
    } = request.server.services();

    try {
      let isForbidden = false;
      if (list === 'my') {
        isForbidden = await permissionService.canGetMyInvitesWorkspace(workspaceId, userId); 
      } else if (list === 'all') {
        isForbidden = await permissionService.canGetAllInvitesWorkspace(workspaceId, userId);
      }

      if (!isForbidden) {
        return Boom.forbidden();
      }

      let invites = [];

      if (list === 'my') {
        invites = await invdb.getInvitesByWorkspaceAndUser(workspaceId, userId);
      } else if (list === 'all') {
        invites = await invdb.getInvitesByWorkspace(workspaceId);
      }
      
      return invites.map(item => displayService.invite(item));
    } catch (e) {
      request.log(['debug-error'], 'Error on get list of my workspace invites' + e + e.stack);
      return Boom.internal();
    }
  }
});
