'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const rp = require('request-promise');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/report-bad-connection',
  options: {
    tags: ['api', 'system'],
    description: 'Report about bad connection',
  },
  handler: async (request, h) => {
    const { userId } = request.auth.credentials;
    const db = request.server.plugins['hapi-pg-promise'].db;

    try {
      const aboutUser = await db.one('SELECT * FROM users WHERE id=$1', [userId]);
      const connections = await request.server.redis.client.hgetall(`user:${userId}`);
      const connWithChannel = Object.values(connections).map(v => JSON.parse(v)).find(c => c.channelId);
      if (!connWithChannel) {
        return Boom.badRequest('You are not in the channel');
      }
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

      return 'ok';
    } catch (e) {
      request.log(['debug-error'], 'Error on report bad connection: ' + e);
      return Boom.internal();
    }
  }
});
