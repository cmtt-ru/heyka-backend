'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const bcrypt = require('bcryptjs');

const pwdHash = '$2y$12$7Sv4IL9V79G.SPHLwi05Ve/lgMfR2rzXaXArRoD4q2dc1UvA.2ScG';

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/stats',
  options: {
    tags: ['api', 'system'],
    description: 'Add statistic info',
    validate: {
      query: Joi.object({
        userId: Joi.string().uuid().optional(),
        after: Joi.date().optional(),
        before: Joi.date().optional(),
      }),
    },
  },
  handler: async (request, h) => {
    const db = request.server.plugins['hapi-pg-promise'].db;
    console.log(request.headers);
    const pwd = request.headers['heyka-system-authorization'];

    const match = await bcrypt.compare(pwd, pwdHash);

    if (!match) {
      return Boom.forbidden();
    }

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

      // prepare query
      let q = `
        SELECT
          id,
          user_id as userId,
          mean_bitrate as meanBitrate,
          created_at as date,
          janus_server_url as janusServerUrl,
          connection_info as connectionInfo
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
      const result = await db.any(q, request.query);

      return result;
    } catch (e) {
      request.log(['debug-error'], 'Error on getting stats: ' + e);
      return Boom.internal();
    }
  }
});
