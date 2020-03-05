'use strict';
const eventNames = require('../event_names');

/**
 * Returns handler-function for "media-state-updated" event from server
 * 
 * Collect all sockets that should be notified
 * about a user that changed his own media state
 * and notify them
 */
module.exports = (io) => {
  return async function mediaStateUpdatedHandler (data) {
    // collect all sockets id
    const socketIds = data.users.reduce((previousReturn, currentUserId) => {
      return [...previousReturn, ...io.userSocketsStorage.getUserSockets(currentUserId)];
    }, []);
    // send event
    socketIds.forEach(socketId => {
      const socket = io.clients().connected[socketId];
      if (!socket) return;
      socket.emit(eventNames.socket.mediaStateUpdated, {
        userId: data.userId,
        userMediaState: data.userMediaState
      });
    });
  };
};
