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
    const { workspaceId } = request.params;
    const { userId } = request.auth.credentials;
    let { count, before } = request.query;
    if (!count) count = 1;
    if (!before) before = new Date();

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
      
      return stats.map(s => ({ ...s, body: JSON.parse(s.body)}));
      
    } catch (e) {

      request.log(['debug-error'], 'Error on get list of users in workspace for admin' + e + e.stack);
      return Boom.internal();
    }
  }
});
