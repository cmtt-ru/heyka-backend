'use strict';

const DISCONNECT_TIMEOUT_IN_CHANNEL = process.env.DISCONNECT_TIMEOUT_IN_CHANNEL
  ? parseInt(process.env.DISCONNECT_TIMEOUT)
  : 60000;
const DISCONNECT_TIMEOUT = process.env.DISCONNECT_TIMEOUT
  ? parseInt(process.env.DISCONNECT_TIMEOUT, 10)
  : 5000;

const eventNames = require('../event_names');

/**
 * Returns handler-function for "disconnect" event from client
 *
 * Deletes socket id from sockets storage
 */
module.exports = (socket, io) => {
  return async function disconnectHandler (reason) {
    if (!socket.userId) return;

    console.log(`~~~~~~~ socket disconnect ${socket.userId} / ${socket.id} because of ${reason}`);

    const {
      connectionService,
    } = socket.server.services();

    const conn = await connectionService.getConnection(socket.id);

    if (!conn) {
      socket.conn.removeAllListeners();
      socket.removeAllListeners();
      return;
    }

    if (conn.channelId) {
      // notify all users from that conversation about user reconnecting
      io
        .to(eventNames.rooms.conversationRoom(conn.channelId))
        .emit(eventNames.socket.conversationBroadcast, {
          action: 'socket-reconnecting',
          userId: conn.userId,
          data: true,
        });
    }

    const disconnectTimeout = conn.channelId ? DISCONNECT_TIMEOUT_IN_CHANNEL : DISCONNECT_TIMEOUT;

    await connectionService.keepConnectionAlive(socket.userId, socket.id, disconnectTimeout);

    setTimeout(async () => {
      console.log(`~~~~~~~ socket disconnect after timeout ${socket.userId} / ${socket.id}`);
      try {
        await connectionService.disconnect(socket.id);
      } catch (e) {
        console.error('Process disconnect: timeout error', e);
      }
    }, disconnectTimeout);

    if (reason !== 'transport close' && reason !== 'client namespace disconnect') {
      console.log(`User ${socket.userId} is disconnected because of "${reason}"`);
    }

    socket.conn.removeAllListeners();
    socket.removeAllListeners();
  };
};
