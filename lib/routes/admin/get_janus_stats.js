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
        workspaceId: Joi.string().required()
      }),
      query: Joi.object({
        count: Joi.number().optional().default(1),
        before: Joi.date().optional(),
      })
    },
  },
  handler: async (request, h) => {
    const {
      permissionService,
    } = request.services();
    let { workspaceId } = request.params;
    const { userId } = request.auth.credentials;
    let { count, before } = request.query;
    if (!count) count = 1;
    if (!before) before = new Date();

    if (workspaceId === 'auto') {
      if (process.env.DEPLOYMENT_ENV === 'stage') {
        workspaceId = '71ec6fa7-5fd5-4b8a-a6f3-738e0a951b72';
      } else if (process.env.DEPLOYMENT_ENV === 'dev') {
        workspaceId = 'd2b3f98c-3749-4242-b319-1416a408b6ed';
      } else {
        workspaceId = '6a6cac4d-6b73-460b-adc6-1df972360537';
      }
    }

    try {
      const canDoIt = await permissionService.canViewUsersStatisticWorkspace(workspaceId, userId);
      
      if (!canDoIt) {
        return Boom.forbidden();
      }

      const db = request.server.plugins['hapi-pg-promise'].db;
      const stats = await db.any(
        'SELECT * FROM janus_stats WHERE created_at < $1 ORDER BY created_at DESC LIMIT $2',
        [before, count]
      );
      
      return stats;
      
    } catch (e) {

      request.log(['debug-error'], 'Error on get list of users in workspace for admin' + e + e.stack);
      return Boom.internal();
    }
  }
});
