'use strict';
const Joi = require('@hapi/joi');
const helpers = require('../helpers');
const eventName = require('../event_names').client.auth;
const eventNames = require('../event_names');
const {
  getUniqueName
} = require('../helpers');

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
      userDatabaseService: udb,
      connectionService,
      channelDatabaseService: chdb,
      workspaceDatabaseService: wdb,
      permissionService,
    } = socket.server.services();

    console.log(`[${socket.id}, ${socket.uniqueName}]: Trying to auth`);

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

      try {
        if (socket.userId && data.prevSocketId === socket.id) {
          const conn = await connectionService.getConnection(socket.id);
          const user = await udb.findById(socket.userId);
          let onlineStatus = user.online_status;
          if (conn.onlineStatus === 'sleep' && user.online_status === 'sleep') {
            await userService.updateOnlineStatus(socket.userId, socket.id, 'online', 'sleep');
            onlineStatus = 'online';
          }
          socket.emit(eventNames.socket.authSuccess, {
            userId: tokenValidation.tokenInfo.userId,
            transaction: data.transaction,
            reconnected: true,
            onlineStatus: onlineStatus,
          });
          return;
        // Если prevSocketId равен socketId, но socket не авторизован, то prevSocketId не имеет смысла
        } else if (!socket.userId && data.prevSocketId === socket.id) {
          data.prevSocketId = null;
        }

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
          console.log(`[${socket.id}, ${socket.uniqueName}]:`
            +` Trying rename socket (old: [${data.prevSocketId}, ${getUniqueName(data.prevSocketId)}]`);
          const connection = await connectionService.renameConnection(data.prevSocketId, socket.id);
          console.log(`[${socket.id}, ${socket.uniqueName}]: Renamed`);
          if (connection && connection.workspaceId === workspaceId) {
            successMessage.reconnected = true;
          }
          if (connection && connection.channelId) {
          // notify all users from that conversation about user finish reconnecting
            console.log(`[${socket.id}, ${socket.uniqueName}]: Reconnecting false`);
            io
              .to(eventNames.rooms.conversationRoom(connection.channelId))
              .emit(eventNames.socket.conversationBroadcast, {
                action: 'socket-reconnecting',
                userId: connection.userId,
                data: false,
              });

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
          console.log(`[${socket.id}, ${socket.uniqueName}]: New authed client`);
        }

        // grab online status
        const user = await udb.findById(userId);

        if (!user) {
          return;
        }

        successMessage.onlineStatus = user.online_status;

        // send success message
        socket.emit(eventNames.socket.authSuccess, successMessage);

        // subscribe for ping packets and keep the socket connection alive
        socket.conn.on('packet', async packet => {
          if (packet.type === 'ping') {
            await connectionService.keepConnectionAlive(socket.id);
            // console.log(`[${socket.id}, ${socket.uniqueName}]: connection alived`);
          }
        });
      } catch(e) {
        console.log('Error during socket authorization: ', e);
        return helpers.handleError(eventName, socket, data, 'System error');
      }

    // Impossible situation
    } else {
      socket.server.log(['error', 'warn'], 'Error on token validation (socket)' + JSON.stringify(data));
    }
  };
};
