'use strict';
const eventNames = require('../event_names');

/**
 * Returns handler-function for "user-changed" event from server
 * 
 * Collect all sockets that should be notified
 * about user changed the profile
 */
module.exports = (io) => {
  return async function channelCreatedHandler (data) {
    // collect all sockets id
    const socketIds = data.users.reduce((previousReturn, currentUserId) => {
      return [...previousReturn, ...io.userSocketsStorage.getUserSockets(currentUserId)];
    }, []);
    // send event
    socketIds.forEach(socketId => {
      const socket = io.clients().connected[socketId];
      if (!socket) return;
      socket.emit(eventNames.socket.userUpdated, data.user);
    });
  };
};
