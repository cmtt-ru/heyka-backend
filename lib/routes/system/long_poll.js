'use strict';

const Helpers = require('../helpers');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/long-poll',
  handler: async (request, h) => {
    await new Promise(resolve => setTimeout(resolve, 5000));
    return 'OK';
  },
  options: {
    auth: false,
    tags: ['api', 'system']
  }
});
