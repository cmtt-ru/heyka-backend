'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');
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
          temporaryCallTotal: Joi.number().integer().min(0),
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
      channelDatabaseService: chdb,
      connectionService,
    } = request.services();

    const getTotalCall = async (channels) => {

      const channelsWithAliveConnectionPromises =  channels.map(async (channel) => {
        const aliveConnections = await connectionService.getChannelConnections(channel.id);

        if(aliveConnections.length > 0){
          return channel;
        }
        else {
          return null;
        }
      });

      const calls = await Promise.all(channelsWithAliveConnectionPromises);

      const filteredCalls = calls.filter(call => call !== null);

      return  filteredCalls.length;
    };
    
    try {
      const temporaryChannels = await  chdb.getTemporaryChannels();
      const publicChannels = await  chdb.getPublicChannels();
      const privateChannels = await  chdb.getPrivateChannels();

      return {
        workspacesTotal: await wdb.getWorkspacesCount(),
        usersTotal: await  udb.getUsersCount(),
        publicCallTotal: await getTotalCall(publicChannels),
        privateCallTotal: await getTotalCall(privateChannels),
        temporaryCallTotal: await getTotalCall(temporaryChannels),
        groupsTotal: await gdb.getGroupsCount(),
      };

    } catch (e) {
      request.log(['debug-error'], 'Error on get channel members: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
