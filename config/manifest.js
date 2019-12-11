'use strict';

const config = require('./index.js');

module.exports = {
  server: {
    port: config.port,
    debug: process.env.NODE_ENV === 'development' ? {
      log: '*',
      request: '*'
    } : undefined
  },
  register: {
    plugins: [
      './lib',
      {
        plugin: 'hapi-redis2',
        options: {
          settings: config.redis.uri,
          decorate: true
        }
      },
      {
        plugin: 'hapi-pg-promise',
        options: {
          cn: config.pg.uri,
          settings: {}
        }
      }
    ]
  }
};
