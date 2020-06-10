'use strict';

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

    if (reason !== 'transport close') {
      console.log(`User ${socket.userId} is disconnected because of "${reason}"`);
    }
    await connectionService.disconnect(socket.id);
  };
};
