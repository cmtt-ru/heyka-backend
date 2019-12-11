'use strict';

const createServer = require('./server');

async function startServer () {
  const server = await createServer();
  server.start();
  server.log(['info'], 'Server started');
}

startServer();
