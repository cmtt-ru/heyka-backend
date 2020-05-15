'use strict';

const Schmervice = require('schmervice');
const uuid4 = require('uuid/v4');
const helpers = require('./helpers');
const eventNames = require('../socket/event_names');

module.exports = class ChannelService extends Schmervice.Service {

  constructor (...args) {
    super(...args);
  }

  /**
   * Creates default channels for provided user and workspace
   * @param {object} user User info
   * @param {object} workspace Workspace info
   */
  async createDefaultChannels (user, workspace) {
    const {
      channelDatabaseService: chdb,
      janusWorkspaceService
    } = this.server.services();
    const now = new Date();

    // prepare default channels for the workspace
    const channelInfo = {
      id: uuid4(),
      name: 'general',
      is_private: false,
      workspace_id: workspace.id,
      creator_id: user.id,
      janus: {
        secret: await helpers.getRandomCode(50)
      }
    };

    // create audio and video room in janus
    const result = await janusWorkspaceService.createAudioVideoRooms(
      channelInfo.id,
      workspace.janus,
      channelInfo.janus.secret
    );
    channelInfo.janus.audioRoomId = result.audioRoomId;
    channelInfo.janus.videoRoomId = result.videoRoomId;

    // insert channel in the database
    await chdb.insertChannel(helpers.withTimestamp(channelInfo, now));

    // add a relation between channel and creator
    const channelMemberInfo = {
      user_id: user.id,
      workspace_id: workspace.id,
      channel_id: channelInfo.id,
      role: chdb.roles().admin,
      janus_auth_token: await helpers.getRandomCode(50),
      token_granted_at: now
    };
    await chdb.addChannelMembers(helpers.withTimestamp(channelMemberInfo, now));

    // add auth token to the Janus channel
    await janusWorkspaceService.manageAuthTokensForChannel(
      'add',
      channelInfo.janus.audioRoomId,
      channelInfo.janus.videoRoomId,
      [ channelMemberInfo.janus_auth_token ],
      workspace.janus,
      channelInfo.janus.secret
    );

    return channelInfo;
  }

  /**
   * Can a user select a certain channel
   * @param {string} channelId Channel id
   * @param {string} userId User id
   * @returns {boolean}
   */
  async canSelectChannel(channelId, userId) {
    const {
      channelDatabaseService: chdb
    } = this.server.services();

    const relation = await chdb.getChannelMemberRelation(channelId, userId);

    if (!relation) return false;
    const roles = chdb.roles();
    return relation.role === roles.admin
      || relation.role === roles.moderator
      || relation.role === roles.user;
  }

  /**
   * Generate token for user for a specific channel
   * Returns the janus auth token
   * @param {string} channelId Channel id
   * @param {string} userId User id
   * @returns {string} Janus auth token
   */
  async grantChannelTokenForUser(channelId, userId) {
    const {
      channelDatabaseService: chdb,
      workspaceDatabaseService: wdb,
      janusWorkspaceService
    } = this.server.services();

    const janusAuthToken = await helpers.getRandomCode(50);
    const relation = await chdb.updateChannelMemberRelation(channelId, userId, {
      janus_auth_token: janusAuthToken
    });
    const channel = await chdb.getChannelById(channelId);
    
    if (!channel) {
      throw new Error('There is no channel with that id');
    }

    const workspace = await wdb.getWorkspaceById(channel.worspace_id);

    if (!workspace) {
      throw new Error('There is no workspace for that channel');
    }

    if (!relation) {
      throw new Error('There are not relations between that user and channel');
    }

    // add token for channel in janus
    await janusWorkspaceService.manageAuthTokensForChannel(
      'add',
      channel.janus.audioRoomId,
      channel.janus.videoRoomId,
      [ janusAuthToken ],
      workspace.janus,
      channel.janus.secret
    );

    return janusAuthToken;
  }

  /**
   * Select channel for user
   * @param {string} channelId Channel id
   * @param {string} userId User id
   * @param {string} socketId Current socket id
   * @param {object} userMediaState Media state of the user
   */
  async selectChannel(channelId, userId, socketId, userMediaState) {
    const {
      apiEventService,
      connectionService
    } = this.server.services();

    const conn = await connectionService.getConnection(socketId);
    if (!conn) return;
    if (conn.channelId === channelId) return;
    const userConnections = await connectionService.getUserConnections(userId, conn.workspaceId);

    const newConnectionObject = {
      ...conn,
      channelId,
      mediaState: userMediaState
    };

    await connectionService.setConnectionObject(newConnectionObject);

    if (conn.channelId) {
      await connectionService.deleteConnectionForChannel(conn.channelId, socketId);
      apiEventService.userUnselectedChannel(userId, conn.channelId, socketId);
    }
    apiEventService.userSelectedChannel(userId, channelId, userMediaState, socketId);

    // if user has another connection in another channel
    // disconect them from channel
    for (let connIndex in userConnections) {
      if (userConnections[connIndex].channelId && userConnections[connIndex].connectionId !== socketId) {
        apiEventService.userChangedDevice(userId, userConnections[connIndex].connectionId);
        await this.unselectChannel(
          userConnections[connIndex].channelId, 
          userId, 
          userConnections[connIndex].connectionId
        );
      }
    }
  }

  async unselectChannel(channelId, userId, socketId) {
    const {
      channelDatabaseService: chdb,
      workspaceService,
      apiEventService,
      connectionService
    } = this.server.services();

    const connection = await connectionService.getConnection(socketId);

    if (!connection || connection.channelId !== channelId) {
      throw new Error('ChannelIsNotSelected');
    }

    delete connection.channelId;
    delete connection.mediaState;

    await connectionService.setConnectionObject(connection);
    await connectionService.deleteConnectionForChannel(channelId, connection.connectionId);

    // Рассылаем сообщение о том, что пользователь покинул канал
    apiEventService.userUnselectedChannel(userId, channelId, socketId);

    const channelConnections = await connectionService.getChannelConnections(channelId);
    // Если в канале больше никого не осталось, 
    // нужно проверить, не надо ли удалить канал (временный)
    if (channelConnections.length === 0) {
      const channel = await chdb.getChannelById(channelId);
      if (channel.tmp_active_until) {
        const now = new Date();
        const activeUntil = new Date(channel.tmp_active_until);
        if (now > activeUntil) {
          // Удаляем канал, так как его активность истекла
          await workspaceService.deleteChannel(channelId);
        }
      }
    }
  }

  /**
   * Updates user media state and notify all channel members
   * @param {string} userId User id
   * @param {string} socketId Socket id
   * @param {object} userMediaState Valid object with user media state
   */
  async updateUserMediaState(userId, socketId, userMediaState) {
    const {
      connectionService
    } = this.server.services();

    const connection = await connectionService.getConnection(socketId);
    if (!connection.channelId) throw new Error('User hasnt joined any channels');

    // const mainSocket = await chdb.getMainSocketForUser(userId);
    // if (mainSocket !== socketId) throw new Error('Socket arent matched');

    connection.mediaState = userMediaState;
    await connectionService.setConnectionObject(connection);

    /**
     * Notify all channel members about updated media state
     */
    this.server.apiEvents.emit('api-event', {
      data: {
        userId,
        userMediaState,
        channelId: connection.channelId
      },
      room: eventNames.rooms.channelRoom(connection.channelId),
      name: eventNames.socket.mediaStateUpdated
    });
  }

  async usersMediaStateInChannel(channelId) {
    const {
      channelDatabaseService: chdb,
      userDatabaseService: udb
    } = this.server.services();

    const users = await chdb.getAllUsersInChannel(channelId);
    const states = await Promise.all(users.map(id => udb.getUserMediaState(id)));
    return states.map((state, index) => ({ ...state, userId: users[index] }));
  }
};
