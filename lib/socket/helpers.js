'use strict';

/**
 * Handles error which was occured in socket-module
 * @param {string} event Event name
 * @param {object} socket
 * @param {object} data Data object
 * @param {string} message Error message
 */
function handleError (event, socket, data, message) {
  if (data.transaction) {
    socket.emit(`socket-api-error-${data.transaction}`, { message });
  }
  socket.emit(`socket-api-error`, { event, message });
  socket.server.log(['socket'], { socketId: socket.id, message, data });
}

exports.handleError = handleError;
