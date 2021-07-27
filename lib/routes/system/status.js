'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/status',
  options: {
    plugins: {
      'hapi-rate-limit': {
        pathLimit: 50
      }
    },
    auth: false,
    tags: ['api'],
    response: {
      status: {
        429: Joi.any().example(Boom.tooManyRequests('Rate limit exceeded')).description('Too Many Requests')
      },
      failAction: 'log',
    }
  },
  handler: async (request, h) => {
    return 'OK';
  },
});
