'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/admin/stats/{statId}',
  options: {
    tags: ['api', 'admin'],
    description: 'Get aggregated info for the stat',
    validate: {
      params: Joi.object({
        statId: Joi.string().uuid().required()
      }),
    },
  },
  handler: async (request, h) => {
    const { statId } = request.params;

    try {
      const db = request.server.plugins['hapi-pg-promise'].db;
      const stat = await db.one('SELECT * FROM stats WHERE id=$1', [statId]);
      if (!stat) {
        return Boom.notFound();
      }
      console.log(stat);
      const before = new Date(stat.created_at);
      const after = new Date(before.getTime() - 30 * 1000);
      const janus_stats = await db.any(
        'SELECT * FROM janus_stats WHERE created_at>$1 AND created_at<$2',
        [after, before]
      );
      
      return {
        clientStats: {
          id: stat.id,
          userId: stat.user_id,
          date: stat.created_at,
          meanBitrate: stat.mean_bitrate,
          janusServerUrl: stat.janus_server_url,
          triggerType: stat.trigger_type,
          additionalInfo: stat.additional_info,
          connectionInfo: stat.connection_info,
        },
        serverStats: janus_stats,
      };
      
    } catch (e) {

      request.log(['debug-error'], 'Error on get aggregated stats' + e + e.stack);
      return Boom.internal();
    }
  }
});
