'use strict';

const DISCONNECT_TIMEOUT = 2000;

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

    const disconnectTimeout = process.env.DISCONNECT_TIMEOUT
      ? parseInt(process.env.DISCONNECT_TIMEOUT, 10)
      : DISCONNECT_TIMEOUT;

    setTimeout(async () => {
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
