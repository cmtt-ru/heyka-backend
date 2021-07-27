'use strict';

const Helpers = require('../helpers');
// const Joi = require('@hapi/joi');
// const Boom = require('@hapi/boom');
//const config = require('../../../config');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/status',
  options: {
    // plugins: {
    //   'hapi-rate-limit': {
    //     pathLimit: config.pathLimit
    //   }
    // },
    auth: false,
    tags: ['api'],
    response: {
      status: {
        // 429: Joi.any().example(Boom.tooManyRequests('Rate limit exceeded')).description('Too Many Requests')
      },
      failAction: 'error',
    }
  },
  handler: async (request, h) => {
    return 'OK';
  },
});
