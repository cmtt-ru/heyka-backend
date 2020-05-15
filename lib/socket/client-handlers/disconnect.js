'use strict';

/**
 * Returns handler-function for "disconnect" event from client
 * 
 * Deletes socket id from sockets storage
 */
module.exports = (socket, io) => {
  return async function disconnectHandler (data) {
    if (!socket.userId) return;

    const {
      connectionService,
    } = socket.server.services();

    await connectionService.disconnect(socket.id);
  };
};
