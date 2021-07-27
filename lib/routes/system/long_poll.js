'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/long-poll',
  handler: async (request, h) => {
    const { timeout } = request.query;

    await new Promise(resolve => setTimeout(resolve, parseInt(timeout, 10)));

    const cf = request.headers['cf-connecting-ip'];
    const xff = request.headers['x-forwarded-for'];
    const xti = request.headers['x-true-ip'];
    const ra = request.info.remoteAddress;

    if (cf) {
      return cf.split(',')[0];
    } else if (xff) {
      return xff.split(',')[0];
    } else if (xti) {
      return xff.split(',')[0];
    } else {
      return ra;
    }
  },
  options: {
    plugins: {
      'hapi-rate-limit': {
        pathLimit: 50
      }
    },
    auth: false,
    tags: ['api', 'system'],
    validate: {
      query: Joi.object({
        timeout: Joi.number().default(5000).max(30000),
      }),
    },
    response: {
      status: {
        429: Joi.any().example(Boom.tooManyRequests('Rate limit exceeded')).description('Too Many Requests')
      },
      failAction: 'log',
    }
  }
});
