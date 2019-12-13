'use strict';
const socketIO = require('socket.io');
const eventNames = require('./event_names');

exports.getSocketIO = async (server) => {
  const io = socketIO({
    path: '/socket.io'
  });

  io.on('connection', (socket) => {
    socket.server = server;

    server.log(['socket'], `Socket ${socket.id} is connected`);
    socket.on(eventNames.client.auth, require('./client-handlers/auth')(socket));
  });
  return io;
};
