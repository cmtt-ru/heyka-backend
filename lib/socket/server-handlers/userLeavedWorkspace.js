'use strict';
const eventNames = require('../event_names');

/**
 * Returns handler-function for "user-leaved" event from server
 * 
 * Collect all sockets that should be notified
 * about leaved the workspace
 */
module.exports = (io) => {
  return async function userLeavedWorkspaceHandler (data) {
    // collect all sockets id
    const socketIds = data.users.reduce((previousReturn, currentUserId) => {
      return [...previousReturn, ...io.userSocketsStorage.getUserSockets(currentUserId)];
    }, []);
    // send event
    socketIds.forEach(socketId => {
      const socket = io.clients().connected[socketId];
      if (!socket) return;
      socket.emit(eventNames.socket.userLeavedWorkspace, { userId: data.userId });
    });
  };
};
