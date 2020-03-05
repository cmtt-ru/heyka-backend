'use strict';
const eventNames = require('../event_names');

/**
 * Returns handler-function for "user-selected-channel" event from server
 * 
 * Collect all sockets that should be notified
 * about a user that selected channel
 * and notify them
 */
module.exports = (io) => {
  return async function userSelectedChannelHandler (data) {
    // collect all sockets id
    const socketIds = data.users.reduce((previousReturn, currentUserId) => {
      return [...previousReturn, ...io.userSocketsStorage.getUserSockets(currentUserId)];
    }, []);
    // send event
    socketIds.forEach(socketId => {
      const socket = io.clients().connected[socketId];
      if (!socket) return;
      socket.emit(eventNames.socket.userSelectedChannel, {
        userId: data.userId,
        channelId: data.channelId
      });
    });
  };
};
