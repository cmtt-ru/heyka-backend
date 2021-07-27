'use strict';

const createServer = require('./server');
const socket = require('./lib/socket');

async function startServer () {
  const server = await createServer();
  const socketIO = await socket.getSocketIO(server);
  socketIO.attach(server.listener, {
    pingInterval: 25000,
    pingTimeout: 15000,
  });
  server.start();

  console.log(`Server running at: ${server.info.uri}`);
  server.log(['info'], 'Server started');
}

startServer();
