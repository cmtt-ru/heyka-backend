'use strict';

const Helpers = require('../helpers');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/slack/event',
  options: {
    auth: false,
    tags: ['api']
  },
  handler: async (request, h) => {
    console.log('===============================');
    console.log(request.payload);
    console.log(request.query);
    const { challenge } = request.payload;

    if (challenge) {
      return challenge;
    }

    return 'OK';
  }
});
