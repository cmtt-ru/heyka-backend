'use strict';
const Joi = require('@hapi/joi');
const helpers = require('../helpers');
const eventName = require('../event_names').client.auth;
const eventNames = require('../event_names');
const onlineStatuses = {
  online: 'online',
  idle: 'idle',
  offline: 'offline'
};
const dataSchema = Joi.object({
  transaction: Joi.string().optional(),
  token: Joi.string().required(),
  workspaceId: Joi.string().uuid().required(),
  onlineStatus: Joi.string().allow(...Object.values(onlineStatuses)).optional(),
  localTimeZone: Joi.string().optional(),
  prevSocketId: Joi.string().optional()
});

/**
 * Returns handler-function for "auth" event from client
 * 
 * 1. Checks access token
 * 2. Joins the socket to certain rooms
 * 3. Links socket and user id in Redis
 */
module.exports = (socket, io) => {
  return async function authHandler (data) {
    const {
      userService,
      connectionService,
      channelDatabaseService: chdb,
      workspaceDatabaseService: wdb,
      permissionService,
    } = socket.server.services();

    // validate input data
    if (dataSchema.validate(data).error) {
      return helpers.handleError(eventName, socket, data, 'Invalid data format for "auth" event');
    }

    const tokenValidation = await userService.isTokenValid(data.token);
    
    // Token doesnt exist
    if (!tokenValidation.result && tokenValidation.cause === 'NotFound') {
      return helpers.handleError(eventName, socket, data, 'Invalid access token');

    // Token is expired
    } else if (!tokenValidation.result && tokenValidation.cause === 'Expired') {
      return helpers.handleError(eventName, socket, data, 'Invalid access token');

    // Token is found
    } else if (tokenValidation.result) {
      const userId = tokenValidation.tokenInfo.userId;
      const workspaceId = data.workspaceId;

      const canUserSubscribe = await permissionService.canSubscribeEventsWorkspace(workspaceId, userId);
      if (!canUserSubscribe) {
        return helpers.handleError(eventName, socket, data, 'Can\'t listen workspace events');
      }

      socket.join(eventNames.rooms.workspaceRoom(workspaceId));
      socket.join(eventNames.rooms.userRoom(userId));
      const userChannels = await wdb.getWorkspaceChannelsForUser(workspaceId, userId);
      
      for (let i = 0; i < userChannels.length; ++i) {
        socket.join(eventNames.rooms.channelRoom(userChannels[i].id));
      }

      // Link that socketId with user
      socket.userId = tokenValidation.tokenInfo.userId;
      socket.workspaceId = workspaceId;

      let successMessage = {
        userId: tokenValidation.tokenInfo.userId,
        transaction: data.transaction,
        reconnected: false
      };

      if (data.prevSocketId) {
        const connection = await connectionService.renameConnection(data.prevSocketId, socket.id);
        if (connection) {
          successMessage.reconnected = true;
        }
        if (connection && connection.channelId) {
          const janusOpts = await chdb.getJanusForChannel(connection.channelId);
          const channel = await chdb.getChannelById(connection.channelId);
          successMessage.channelId = connection.channelId;
          successMessage.channelAuthToken = connection.janusChannelAuthToken;
          successMessage.serverAuthToken = connection.janusServerAuthToken;
          successMessage.janusServerUrl = janusOpts.httpsUrl;
          successMessage.janusWsServerUrl = janusOpts.wssUrl;
          successMessage.audioRoomId = channel.janus.room;
          successMessage.videoRoomId = channel.janus.room;
        }
      }
      
      if (!successMessage.reconnected) {
        // add connection to the database
        const onlineStatus = data.onlineStatus || onlineStatuses.online;
        await connectionService.connect(
          socket.id,
          workspaceId,
          tokenValidation.tokenInfo.userId,
          onlineStatus,
          null,
          data.localTimeZone || 'Europe/Moscow'
        );
      }

      // send success message
      socket.emit(eventNames.socket.authSuccess, successMessage);

      // subscribe for ping packets and keep the socket connection alive
      socket.conn.on('packet', async packet => {
        if (packet.type === 'ping') {
          await connectionService.keepConnectionAlive(socket.id);
        }
      });

    // Impossible situation
    } else {
      socket.server.log(['error', 'warn'], 'Error on token validation (socket)' + JSON.stringify(data));
    }
  };
};
