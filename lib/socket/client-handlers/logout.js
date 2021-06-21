'use strict';

/**
 * Returns handler-function for "logout" event
 *
 * Deletes connection and disconnect socket
 */
module.exports = (socket, io) => {
  return async function logoutHandler (reason) {
    if (!socket.userId) return;
    socket.userId = null;

    const {
      connectionService,
    } = socket.server.services();

    socket.conn.removeAllListeners();
    socket.removeAllListeners();
    socket.disconnect();

    try {
      await connectionService.disconnect(socket.id);
    } catch (e) {
      console.log('Error in logout:', e)
    }
  };
};
