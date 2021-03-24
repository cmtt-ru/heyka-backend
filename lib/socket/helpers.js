'use strict';
const {
  uniqueNamesGenerator,
  adjectives,
  colors,
  animals,
} = require('unique-names-generator');

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
  console.log('socket-api-error', socket.id, message);
  socket.emit(`socket-api-error`, { event, message });
  socket.server.log(['socket'], { socketId: socket.id, message, data });
}

function getUniqueName (seed) {
  const seedString = seed
    .split('')
    .map(c=>c.charCodeAt(0))
    .reduce((p,c,i)=>i%2===0?p+`${c}`:p, '')
    .split('')
    .splice(0,24)
    .join('');
  const seedNumber = parseInt(seedString);
  return uniqueNamesGenerator({
    length: 3,
    dictionaries: [adjectives, colors, animals],
    separator: '-',
    seed: seedNumber,
  });
}

exports.handleError = handleError;
exports.getUniqueName = getUniqueName;
