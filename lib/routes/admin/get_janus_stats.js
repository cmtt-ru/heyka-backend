'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/admin/workspaces/{workspaceId}/janus-stats',
  options: {
    tags: ['api', 'admin'],
    description: 'Get workspace janus stats',
    validate: {
      params: Joi.object({
        workspaceId: Joi.string().uuid().required()
      })
    },
  },
  handler: async (request, h) => {
    const {
      workspaceService,
      janusWorkspaceService,
      permissionService,
      channelDatabaseService: chdb,
    } = request.services();
    const { workspaceId } = request.params;
    const { userId } = request.auth.credentials;

    try {
      const canDoIt = await permissionService.canViewUsersStatisticWorkspace(workspaceId, userId);
      
      if (!canDoIt) {
        return Boom.forbidden();
      }
      
      const [
        workspaceState,
        janusStats,
      ] = await Promise.all([
        workspaceService.getWorkspaceStateForUser(workspaceId, userId),
        janusWorkspaceService.getJanusStatsForAllServers(),
      ]);

      workspaceState.channels = await Promise.all(workspaceState.channels.map(async ch => {
        const result = { ...ch };

        const janusForChannel = await chdb.getJanusForChannel(ch.id);
        if (!janusForChannel) {
          return ch;
        }

        result.janusDetails = janusForChannel;
        return result;
      }));

      const sessionsByUsers = {};

      Object.keys(janusStats).forEach(serverUrl => {
        if (!sessionsByUsers[serverUrl]) {
          sessionsByUsers[serverUrl] = {};
        }

        Object.keys(janusStats[serverUrl]).forEach(sessionId => {
          const handle = Object
            .values(janusStats[serverUrl][sessionId])
            .find(h => h.plugin_specific && h.plugin_specific.display);

          if (!handle) {
            return;
          }
          let sessionUserId = handle.plugin_specific.display;
          sessionUserId = sessionUserId.replace('(receiver)', '').replace('(sender)', '');
  
          if (!sessionsByUsers[serverUrl][sessionUserId]) {
            sessionsByUsers[serverUrl][sessionUserId] = [];
          }
  
          sessionsByUsers[serverUrl][sessionUserId].push(janusStats[serverUrl][sessionId]);
        });
      });

      workspaceState.channels.forEach(ch => {
        ch.users.forEach(u => {
          u.janusStats = sessionsByUsers[ch.janusDetails.publicHttpsUrl][u.userId];
          delete sessionsByUsers[ch.janusDetails.publicHttpsUrl][u.userId];
        });
      });

      return { workspaceState, undefinedJanusStats: sessionsByUsers };
    } catch (e) {

      request.log(['debug-error'], 'Error on get list of users in workspace for admin' + e + e.stack);
      return Boom.internal();
    }
  }
});
