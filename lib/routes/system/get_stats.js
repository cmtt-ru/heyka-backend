'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/stats',
  options: {
    tags: ['api', 'system'],
    description: 'Add statistic info',
    validate: {
      query: Joi.object({
        triggerType: Joi.string().optional(),
        userId: Joi.string().uuid().optional(),
        after: Joi.date().optional(),
        before: Joi.date().optional(),
      }),
    },
  },
  handler: async (request, h) => {
    const db = request.server.plugins['hapi-pg-promise'].db;

    try {
      // collect all conditions in one array
      const conds = [];
      if (request.query.userId) {
        conds.push('user_id = ${userId}');
      }
      if (request.query.after) {
        conds.push('created_at > ${after}');
      }
      if (request.query.before) {
        conds.push('created_at < ${before}');
      }
      if (request.query.triggerType) {
        conds.push('trigger_type = ${triggerType}');
      }

      // prepare query
      let q = `
        SELECT
          *
        FROM
          stats
      `;
      if (conds.length > 0) {
        q += ' WHERE ';
        conds.forEach((cond, i) => {
          if (i > 0) q += ' AND ';
          q += cond;
        });
      }
      q += ' ORDER BY created_at DESC';

      // make query
      const list = await db.any(q, request.query);

      return list.map(el => ({
        id: el.id,
        userId: el.user_id,
        date: el.created_at,
        meanBitrate: el.mean_bitrate,
        janusServerUrl: el.janus_server_url,
        triggerType: el.trigger_type,
        additionalInfo: el.additional_info,
        connectionInfo: el.connection_info,
      }));
    } catch (e) {
      request.log(['debug-error'], 'Error on getting stats: ' + e);
      return Boom.internal();
    }
  }
});
