'use strict';

const config = require('./index.js');

module.exports = {
  server: {
    port: config.port,
    debug: process.env.NODE_ENV === 'development' ? {
      log: '*',
      request: '*'
    } : process.env.NODE_ENV === 'test' ? {
      log: ['debug-error'],
      request: ['debug-error']
    } : undefined
  },
  register: {
    plugins: [
      // main plugin (API)
      './lib',
      // plugin for Redis
      {
        plugin: 'hapi-redis2',
        options: {
          settings: config.redis.uri,
          decorate: true
        }
      },
      // plugin for Postgresql
      {
        plugin: 'hapi-pg-promise',
        options: {
          cn: config.pg.uri,
          settings: {}
        }
      },
      // plugin for global event emitter
      {
        plugin: 'hapi-emitter',
        options: {
          name: 'apiEvents'
        }
      }
    ]
  }
};
