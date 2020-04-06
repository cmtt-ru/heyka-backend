'use strict';
const eventNames = require('../event_names');
const onlineStatuses = {
  online: 'online',
  idle: 'idle',
  offline: 'offline'
};

/**
 * Returns handler-function for "disconnect" event from client
 * 
 * Deletes socket id from sockets storage
 */
module.exports = (socket, io) => {
  return async function disconnectHandler (data) {
    if (!socket.userId) return;
    const userId = socket.userId;
    const workspaceId = socket.workspaceId;

    const {
      userDatabaseService: udb,
      userService
    } = socket.server.services();

    socket.userSocketsStorage.deleteSocketForUser(socket.userId, socket.id);
    // update online status of the user
    const oldOnlineStatus = await udb.getOnlineStatus(userId, workspaceId);
    if (oldOnlineStatus === onlineStatuses.offline) return;
    userService.updateOnlineStatus(userId, workspaceId, onlineStatuses.offline);

    // delete workspace id for that socket
    await udb.removeWorkspaceForSocket(socket.id);
  };
};
