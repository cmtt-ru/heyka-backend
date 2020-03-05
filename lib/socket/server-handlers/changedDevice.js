'use strict';
const eventNames = require('../event_names');

/**
 * Returns handler-function for the event when user changed device
 * Notify a certain socket about the event
 */
module.exports = (io) => {
  return async function changedDeviceHandler (data) {
    const socket = io.clients().connected[data.socketId];
    if (!socket) return;
    socket.emit(eventNames.socket.changedDevice);
  };
};
