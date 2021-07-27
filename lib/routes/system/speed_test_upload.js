'use strict';

const Helpers = require('../helpers');
// const Joi = require('@hapi/joi');
// const Boom = require('@hapi/boom');
// //const config = require('../../../config');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/speedtest',
  options: {
    // plugins: {
    //   'hapi-rate-limit': {
    //     pathLimit: config.pathLimit
    //   }
    // },
    auth: false,
    payload: {
      maxBytes: 1000 * 1000 * 1024, // 1024 Mb,
      output: 'stream',
      parse: false,
      allow: 'multipart/form-data'
    },
    response: {
      status: {
        // 429: Joi.any().example(Boom.tooManyRequests('Rate limit exceeded')).description('Too Many Requests')
      },
      failAction: 'error'
    }
  },
  handler: async (request, h) => { 
    const stream = request.raw.req;
    await new Promise((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
      stream.resume();
    });
    return 'ok';
  },
});
