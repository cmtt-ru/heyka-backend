'use strict';
const socketIO = require('socket.io');
const eventNames = require('./event_names');
const redisAdapter = require('socket.io-redis');
const Redis = require('ioredis');
const config = require('../../config');

exports.getSocketIO = async (server) => {
  const io = socketIO({
    path: '/socket.io',
    pingInterval: 25000, // by default
    pingTimeout: 15000 // how many ms without a pong packet to consider the connection closed
  });
  if (config.redis.sentinels) {
    io.adapter(redisAdapter({
      pubClient: new Redis(config.redis),
      subClient: new Redis(config.redis)
    }));
  } else {
    io.adapter(redisAdapter(config.redis.uri));
  }

  io.on('connection', (socket) => {
    socket.server = server;
    socket.userSocketsStorage = io.userSocketsStorage;

    socket.on(eventNames.client.auth, require('./client-handlers/auth')(socket, io));
    socket.on(eventNames.client.disconnect, require('./client-handlers/disconnect')(socket, io));
  });

  server.apiEvents.on('api-event', evt => {
    if (evt.room) {
      io.to(evt.room).emit(evt.name, evt.data);
    } else if (evt.rooms) {
      for (let i = 0; i < evt.rooms.length; i++) {
        io.to(evt.rooms[i]).emit(evt.name, evt.data);
      }
    }
  });

  server.apiEvents.on('subscribe-sockets', evt => {
    if (!evt.sockets.length) {
      return;
    }

    evt.sockets.forEach(socketId => {
      io.of('/').adapter.remoteJoin(socketId, evt.room);
    });
  });

  return io;
};
