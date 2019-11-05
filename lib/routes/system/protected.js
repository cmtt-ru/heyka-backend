'use strict';

const Helpers = require('../helpers');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/protected',
  handler: async (request, h) => {
    return 'OK';
  }
});
