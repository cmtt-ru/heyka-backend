'use strict';
const eventNames = require('../event_names');

/**
 * Returns handler-function for "conversation-broadcast" event from client
 * 
 * Broadcast that event to all sockets in this conversation
 */
module.exports = (socket, io) => {
  return async function conversationBroadcastHandler (data) {
    if (!socket.userId) return;

    const {
      connectionService,
    } = socket.server.services();

    const conn = await connectionService.getConnection(socket.id);

    if (!conn || !conn.channelId) {
      return;
    }

    if (typeof data === 'object') {
      data.userId = conn.userId;
    }

    io
      .to(eventNames.rooms.conversationRoom(conn.channelId))
      .emit(eventNames.socket.conversationBroadcast, data);
  };
};
