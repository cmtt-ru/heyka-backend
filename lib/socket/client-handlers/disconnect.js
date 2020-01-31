'use strict';

/**
 * Returns handler-function for "disconnect" event from client
 * 
 * Deletes socket id from sockets storage
 */
module.exports = (socket) => {
  return async function disconnectHandler (data) {
    if (!socket.userId) return;
    socket.userSocketsStorage.deleteSocketForUser(socket.userId, socket.id);
  };
};
