'use strict';

const Helpers = require('../helpers');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/protected',
  options: {
    auth: 'simple',
    tags: ['api']
  },
  handler: async (request, h) => {
    return 'OK';
  }
});
