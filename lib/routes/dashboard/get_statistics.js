'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');
const schemas = require('../../schemas');
const errorMessages = require('../../error_messages');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/statistics',
  options: {
    tags: ['api', 'dashboard'],
    description: 'Get total number of workspaces, users, calls, groups',
    response: {
      status: {
        200: Joi.object({
          workspacesTotal: Joi.number().integer().min(0),
          usersTotal: Joi.number().integer().min(0),
          publicCallTotal: Joi.number().integer().min(0),
          privateCallTotal: Joi.number().integer().min(0),
          groupsTotal: Joi.number().integer().min(0),
        }).label('Statistics details'),
        403: Joi.any().example(Boom.forbidden(errorMessages.accessDenied).output.payload)
          .description('User hasn\'t access to the channel')
      },
      failAction: 'error',
    }
  },
  handler: async (request, h) => {
    const {
      groupDatabaseService: gdb,
      workspaceDatabaseService: wdb,
      userDatabaseService: udb,
    } = request.services();

    // const { userId } = request.auth.credentials;
    // const { channelId } = request.params;
    
    try {
      // const canSelect = await permissionService.canViewInfoChannel(channelId, userId);
      //
      // if (!canSelect) {
      //   return Boom.forbidden(errorMessages.accessDenied);
      // }
      //
      // const channelMembers = await chdb.getChannelMembersWithWorkspaceRoles(channelId);
      // return channelMembers.map(u => displayService.channelMemberInfo(u));
      return {
        workspacesTotal: await wdb.getWorkspacesCount(),
        usersTotal: await  udb.getUsersCount(),
        publicCallTotal:'query',
        privateCallTotal:'query',
        groupsTotal: await gdb.getGroupsCount(),
      };

    } catch (e) {
      request.log(['debug-error'], 'Error on get channel members: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
