'use strict';

const Helpers = require('../helpers');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/status',
  handler: async (request, h) => {
    return 'OK';
  },
  options: {
    auth: false
  }
});
