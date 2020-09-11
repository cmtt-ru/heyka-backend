'use strict';

const Helpers = require('../helpers');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/speedtest',
  options: {
    auth: false,
    payload: {
      maxBytes: 1000 * 1000 * 1024, // 1024 Mb,
      output: 'stream',
      parse: false,
      allow: 'multipart/form-data'
    },
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
