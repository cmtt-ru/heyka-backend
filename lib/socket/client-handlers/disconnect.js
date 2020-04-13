'use strict';
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
      channelDatabaseService: chdb,
      channelService,
      userService
    } = socket.server.services();

    socket.userSocketsStorage.deleteSocketForUser(socket.userId, socket.id);
    // update online status of the user
    const oldOnlineStatus = await udb.getOnlineStatus(userId, workspaceId);
    if (oldOnlineStatus !== onlineStatuses.offline) {
      userService.updateOnlineStatus(userId, workspaceId, onlineStatuses.offline);
    }

    // user unselect channel
    const channelId = await chdb.getChannelByUserId(userId);
    const mainSocketForUser = await chdb.getMainSocketForUser(userId);
    if (channelId && socket.id === mainSocketForUser) {
      await channelService.unselectChannel(channelId, userId, socket.id);
    }

    // delete workspace id for that socket
    await udb.removeWorkspaceForSocket(socket.id);
  };
};
