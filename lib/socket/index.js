'use strict';
const socketIO = require('socket.io');
const eventNames = require('./event_names');
const { UserSocketsStorage } = require('./userSocketsStorage');

exports.getSocketIO = async (server) => {
  const io = socketIO({
    path: '/socket.io'
  });
  io.userSocketsStorage = new UserSocketsStorage();

  io.on('connection', (socket) => {
    socket.server = server;
    socket.userSocketsStorage = io.userSocketsStorage;

    server.log(['socket'], `Socket ${socket.id} is connected`);
    socket.on(eventNames.client.auth, require('./client-handlers/auth')(socket));
    socket.on(eventNames.client.disconnect, require('./client-handlers/disconnect')(socket));
  });

  server.apiEvents.on(eventNames.server.channelCreated, require('./server-handlers/channelCreated')(io));
  return io;
};
