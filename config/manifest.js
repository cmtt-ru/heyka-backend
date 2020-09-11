'use strict';

const config = require('./index.js');

module.exports = {
  server: {
    port: config.port,
    host: config.host,
    routes: {
      cors: true
    },
    debug: process.env.NODE_ENV === 'development' ? {
      log: ['debug-error'],
      request: ['debug-error'],
    } : process.env.NODE_ENV === 'test' ? {
      log: ['debug-error'],
      request: ['debug-error'],
    } : undefined
  },
  register: {
    plugins: [
      '@hapi/inert',
      // main plugin (API)
      './lib',
      // plugin for Redis
      {
        plugin: 'hapi-redis2',
        options: {
          settings: config.redis.sentinels ? {
            sentinels: config.redis.sentinels,
            sentinelPassword: config.redis.sentinelPassword,
            name: config.redis.name
          } : config.redis.uri,
          decorate: true
        }
      },
      // plugin for Postgresql
      {
        plugin: 'hapi-pg-promise',
        options: {
          cn: config.pg.uri,
          init: {
            noWarnings: process.env.NODE_ENV === 'test'
          }
        }
      },
      // plugin for global event emitter
      {
        plugin: 'hapi-emitter',
        options: {
          name: 'apiEvents'
        }
      },
      
      // add swagger if development mode (swagger requires inert and vision for static files)
      ...(
        process.env.NODE_ENV === 'development' ? [
          '@hapi/vision',
          {
            plugin: 'hapi-swagger',
            options: {
              info: {
                title: 'API documentation'
              },
              securityDefinitions: {
                simple: {
                  type: 'apiKey',
                  description: 'Required a valid access token',
                  name: 'Authorization',
                  in: 'header'
                }
              },
              security: [{
                simple: []
              }],
              grouping: 'tags'
            }
          }
        ] :
          []
      )
    ]
  }
};
