'use strict';

const Redlock = require('redlock');

const plugin = {
  pkg: require('./package.json'),
  register: async function (server, options) {
    // initialize redlock
    const redlock = new Redlock([ server.redis.client ], {
      driftFactor: 0.01,
      retryCount: 10,
      retryDelay: 200,
      retryJitter: 200,
    });

    server.expose('redlock', redlock);

    return server;
  },
  dependencies: 'hapi-redis2',
};

module.exports = plugin;
