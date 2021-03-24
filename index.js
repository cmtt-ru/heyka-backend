'use strict';

const createServer = require('./server');
const socket = require('./lib/socket');

async function startServer () {
  const server = await createServer();
  const socketIO = await socket.getSocketIO(server);
  socketIO.attach(server.listener, {
    pingInterval: 1000,
    pingTimeout: 1000,
  });
  server.start();
  server.log(['info'], 'Server started');
}

startServer();
