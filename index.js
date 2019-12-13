'use strict';

const createServer = require('./server');
const socket = require('./lib/socket');

async function startServer () {
  const server = await createServer();
  const socketIO = await socket.getSocketIO(server);
  socketIO.attach(server.listener);
  server.start();
  server.log(['info'], 'Server started');
}

startServer();
