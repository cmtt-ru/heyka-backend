'use strict';

const DISCONNECT_TIMEOUT = 60000;

/**
 * Returns handler-function for "disconnect" event from client
 * 
 * Deletes socket id from sockets storage
 */
module.exports = (socket, io) => {
  return async function disconnectHandler (reason) {
    if (!socket.userId) return;

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
      const disconnectTimeout = process.env.DISCONNECT_TIMEOUT
        ? parseInt(process.env.DISCONNECT_TIMEOUT, 10)
        : DISCONNECT_TIMEOUT;

      setTimeout(async () => {
        await connectionService.disconnect(socket.id);
      }, disconnectTimeout);
      if (reason !== 'transport close' && reason !== 'client namespace disconnect') {
        console.log(`User ${socket.userId} is disconnected because of "${reason}"`);
      }
    } else {
      await connectionService.disconnect(socket.id);
    }

    socket.conn.removeAllListeners();
    socket.removeAllListeners();
  };
};
