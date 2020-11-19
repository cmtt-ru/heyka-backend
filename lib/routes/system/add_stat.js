'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const uuid = require('uuid/v4');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/stats',
  options: {
    tags: ['api', 'system'],
    description: 'Add statistic info',
    validate: {
      payload: Joi.object({
        meanBitrate: Joi.number().required(),
        janusServerUrl: Joi.string().uri().required(),
        triggerType: Joi.string().optional().default('auto'),
        additionalInfo: Joi.object().optional(),
        connectionInfo: Joi.array().items(Joi.object({
          output: Joi.number().required(),
          input: Joi.number().required(),
          lost: Joi.number().required(),
        })),        
      })
    },
  },
  handler: async (request, h) => {
    const { userId } = request.auth.credentials;
    const db = request.server.plugins['hapi-pg-promise'].db;
    const now = new Date();

    try {
      const object = {
        id: uuid(),
        user_id: userId,
        created_at: now,
        janus_server_url: request.payload.janusServerUrl,
        mean_bitrate: request.payload.meanBitrate,
        connection_info: request.payload.connectionInfo,
        trigger_type: request.payload.triggerType,
        additional_info: request.payload.additionalInfo || {},
      };
      
      await db.query(
        'INSERT INTO stats(${this:name}) VALUES '
        + '(${id}, ${user_id}, ${created_at}, ${janus_server_url}, '
        + '${mean_bitrate}, ${connection_info:json}, ${trigger_type}, ${additional_info:json})',
        object
      );
      if (object.trigger_type === 'user') {
        db.query(
          'UPDATE janus_stats SET do_not_delete = TRUE WHERE created_at > $1',
          new Date(Date.now() - 35 * 1000)
        );
      }

      return 'ok';
    } catch (e) {
      request.log(['debug-error'], 'Error on add stats: ' + e);
      return Boom.internal();
    }
  }
});
