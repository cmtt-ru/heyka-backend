'use strict';

const config = require('./index.js');
const Boom = require('@hapi/boom');

module.exports = {
  server: {
    port: config.port,
    host: config.host,
    routes: {
      cors: true,
      validate: {
        failAction (request, h, err) {
          if (process.env.NODE_ENV === 'production') {
            throw Boom.badRequest();
          } else {
            console.error(err);
            throw err;
          }
        }
      },
    },
    debug: process.env.NODE_ENV === 'development' ? {
      log: '*',
      request: '*',
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
            noWarnings: process.env.NODE_ENV === 'test',
            error: (err, e) => {
              console.log('٩(๑•̀ㅂ•́)و');
              console.log('Database error');

              if (e.query) {
                console.log('-- SQL query:');
                console.log(e.query);
              }else{
                console.log('-- No SQL query available');
              }

              if (e.cn) {
                console.log('-- Connection error:');
                console.log(e.cn);
              }

              if (e.ctx) {
                console.log('-- Error occurred inside a task or transaction:');
                console.log(e.ctx);
              }

              console.log('-- Trace:');
              console.trace();

              console.log('-- Error:');
              console.log(err);
            }
          },
        }
      },
      // plugin for global event emitter
      {
        plugin: 'hapi-emitter',
        options: {
          name: 'apiEvents'
        }
      },

      // Redlock plugin
      require('../plugins/redlock'),

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
