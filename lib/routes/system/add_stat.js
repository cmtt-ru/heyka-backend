'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const uuid = require('uuid/v4');
const rp = require('request-promise');

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
        const aboutUser = await db.one('SELECT * FROM users WHERE id=$1', [userId]);
        const connections = await request.server.redis.client.hgetall(`user:${userId}`);
        const connWithChannel = Object.values(connections).map(v => JSON.parse(v)).find(c => c.channelId);
        const channel = await db.one('SELECT * FROM channels WHERE id=$1', [connWithChannel.channelId]);
        const envType = process.env.DEPLOYMENT_ENV || 'local';
        await Promise.all([
          // keep related janus stats saved
          db.query(
            'UPDATE janus_stats SET do_not_delete = TRUE WHERE created_at > $1',
            new Date(Date.now() - 35 * 1000)
          ),

          // send slack notification about report
          rp('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
              Authorization: `Bearer xoxb-3304904663-1517005148467-nrqsOO6wDmDSOV6YAjwhNmFB`,
            },
            json: true,
            body: {
              channel: "C01F3LRE0MB",
              text: `${aboutUser.name} сообщил о проблемах с соединением (${envType} env) в канале ${channel.name}.`
              // eslint-disable-next-line
              + `\n<https://heyka.app/janus-monitoring/c/${connWithChannel.channelId}/u/${aboutUser.id}|Janus monitoring>`
              + `\n<https://heyka.app/janus-dashboard|Janus dashboard>`,
            },
          }),
        ]);
      }

      return 'ok';
    } catch (e) {
      request.log(['debug-error'], 'Error on add stats: ' + e);
      return Boom.internal();
    }
  }
});
