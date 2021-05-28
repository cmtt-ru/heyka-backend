'use strict';

const Schmervice = require('schmervice');
const uuid4 = require('uuid/v4');
const helpers = require('./helpers');
const eventNames = require('../socket/event_names');

const INVITE_CODE_LIFESPAN = 24 * 3600 * 1000; // 30 days;

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
      channelDatabaseService: chdb
    } = this.server.services();
    const now = new Date();

    const [
      room,
      secret
    ] = await Promise.all([ helpers.getSecureRandomNumber(), helpers.getRandomCode(50) ]);

    // prepare default channels for the workspace
    const channelInfo = {
      id: uuid4(),
      name: 'general',
      is_private: false,
      is_tmp: false,
      workspace_id: workspace.id,
      creator_id: user.id,
      janus: { room, secret }
    };

    // insert channel in the database
    await chdb.insertChannel(helpers.withTimestamp(channelInfo, now));

    // add a relation between channel and creator
    const channelMemberInfo = {
      user_id: user.id,
      workspace_id: workspace.id,
      channel_id: channelInfo.id,
      role: chdb.roles().admin
    };
    await chdb.addChannelMembers(helpers.withTimestamp(channelMemberInfo, now));

    return channelInfo;
  }

  /**
   * @deprecated
   *  token for user for a specific channel
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
   * @returns {object} Janus connection options
   */
  async selectChannel(channelId, userId, socketId, userMediaState) {
    const {
      apiEventService,
      connectionService,
      channelDatabaseService: chdb,
      janusWorkspaceService,
      userService,
    } = this.server.services();

    const conn = await connectionService.getConnection(socketId);
    if (!conn) {
      console.log('connections is not existed');
      throw new Error('ConnectionNotFound');
    }
    if (conn.channelId === channelId) {
      throw new Error('ChannelAlreadySelected');
    }

    const channel = await chdb.getChannelById(channelId);

    if (!channel) {
      throw new Error('ChannelNotFound');
    }

    // is there a janus channel for that channel
    let janus = await chdb.getJanusForChannel(channelId);
    if (!janus) {
      janus = await janusWorkspaceService.getJanus();
      janus.channelSecret = await helpers.getRandomCode(50);
      await chdb.setJanusForChannel(channelId, janus);
      // create janus channel
      try {
        await janusWorkspaceService.createAudioVideoRooms(channel.janus, channelId, janus);
      } catch (e) {
        // скорее всего это ситуация, когда два юзера одновременно нажали
        // на вход в канал и запрос к янусу текущего юзера выполнился позже остальных
        // если это не так, кидаем ошибку дальше
        if (e.message !== 'AlreadyExists') {
          throw e;
        }
        this.server.log(['debug'], `Two users simultaneously created this channel (${channel.janus.room})`);
      }
    }

    // add janus auth token for server and channels
    let channelAuthToken, serverAuthToken;
    try {
      [
        channelAuthToken,
        serverAuthToken
      ] = await Promise.all([ helpers.getRandomCode(50), helpers.getRandomCode(50) ]);
      await Promise.all([
        janusWorkspaceService.manageAuthTokensForChannel('add', [ channelAuthToken ], janus, channel.janus),
        janusWorkspaceService.addAuthTokenForWorkspace(serverAuthToken, janus)
      ]);
    } catch (e) {
      // if room exists in database, but don't exists in janus, create
      if (e.message.includes('No such room')) {
        try {
          await janusWorkspaceService.createAudioVideoRooms(channel.janus, channelId, janus);
        } catch (e) {
          if (e.message !== 'AlreadyExists') {
            throw e;
          }
        }

        // try to add tokens one more time
        [
          channelAuthToken,
          serverAuthToken
        ] = await Promise.all([ helpers.getRandomCode(50), helpers.getRandomCode(50) ]);
        await Promise.all([
          janusWorkspaceService.manageAuthTokensForChannel('add', [ channelAuthToken ], janus, channel.janus),
          janusWorkspaceService.addAuthTokenForWorkspace(serverAuthToken, janus)
        ]);
      }
    }


    const userConnections = await connectionService.getUserConnections(userId, conn.workspaceId);

    const newConnectionObject = {
      ...conn,
      channelId,
      janusChannelAuthToken: channelAuthToken,
      janusServerAuthToken: serverAuthToken,
      mediaState: userMediaState
    };

    if (conn.channelId) {
      await this.unselectChannel(conn.channelId, userId, conn.connectionId);
    }

    await connectionService.setConnectionObject(newConnectionObject);
    apiEventService.userSelectedChannel(userId, channelId, userMediaState, socketId);

    // if user has another connection in another channel
    // disconect them from channel
    for (let connIndex in userConnections) {
      if (userConnections[connIndex].channelId && userConnections[connIndex].connectionId !== socketId) {
        apiEventService.userChangedDevice(userId, userConnections[connIndex].connectionId);
        const withoutNotifying = userConnections[connIndex].channelId === channelId;
        await this.unselectChannel(
          userConnections[connIndex].channelId, 
          userId,
          userConnections[connIndex].connectionId,
          withoutNotifying
        );
      }
    }

    // cancel all invites in that channel for that user
    userService.cancelChannelInvitesForUser(channelId, userId);

    // increase usage count for this channel
    userService.increaseChannelUsageCount(userId, channelId);

    // join socket to conversation room
    this.server.apiEvents.emit('subscribe-sockets', {
      room: eventNames.rooms.conversationRoom(channelId),
      sockets: [ socketId ],
    });

    return {
      httpsUrl: janus.publicHttpsUrl || janus.url,
      wssUrl: janus.publicWssUrl || janus.publicUrl,
      audioRoomId: channel.janus.room,
      videoRoomId: channel.janus.room,
      serverAuthToken,
      channelAuthToken
    };
  }

  async unselectChannel(channelId, userId, socketId, withoutNotifying = false) {
    const {
      channelDatabaseService: chdb,
      workspaceService,
      apiEventService,
      connectionService,
      janusWorkspaceService
    } = this.server.services();

    const connection = await connectionService.getConnection(socketId);

    if (!connection || connection.channelId !== channelId) {
      throw new Error('ChannelIsNotSelected');
    }

    const channel = await chdb.getChannelById(channelId);

    if (!channel) {
      // ignore this error, we need to clear session;
      // throw new Error('ChannelAlreadyDeleted');
      delete connection.channelId;
      delete connection.mediaState;
      delete connection.janusServerAuthToken;
      delete connection.janusChannelAuthToken;
  
      await connectionService.setConnectionObject(connection);
      return;
    }

    const authToken = connection.janusServerAuthToken;
    const channelAuthToken = connection.janusChannelAuthToken;
    delete connection.channelId;
    delete connection.mediaState;
    delete connection.janusServerAuthToken;
    delete connection.janusChannelAuthToken;

    await connectionService.setConnectionObject(connection);
    await connectionService.deleteConnectionForChannel(channelId, connection.connectionId);

    // Рассылаем сообщение о том, что пользователь покинул канал
    if (!withoutNotifying) {
      apiEventService.userUnselectedChannel(userId, channelId, socketId);
    }

    const channelConnections = await connectionService.getChannelConnections(channelId);
    // Если в канале больше никого не осталось, 
    if (channelConnections.length === 0) {

      // удаляем канал, если он был временный
      if (channel.is_tmp) {
        // если указано время жизни, удаляем только если просрочился
        if (channel.tmp_active_until) {
          const now = new Date();
          const activeUntil = new Date(channel.tmp_active_until);
          if (now > activeUntil) {
            // Удаляем канал, так как его активность истекла
            await workspaceService.deleteChannel(channelId);
          }
        } else {

          // иначе удаляем просто так
          await workspaceService.deleteChannel(channelId);
        }
      } else {
        // если канал не был временным, то мы его не удалили
        // но из януса его все равно надо удалить
        const janusOpts = await chdb.getJanusForChannel(channelId);
        if (janusOpts) {
          try {
            await janusWorkspaceService.deleteAudioVideoRooms(janusOpts, channel.janus);
            janusWorkspaceService.decrementJanusChannelsFor(janusOpts.name);
          } catch(e) {
            if (e.message !== 'RoomAlreadyDeleted') {
              throw e;
            }
          }
          await chdb.deleteJanusForChannel(channelId);
        }
      }

    } else {
      // если в канале кто-то еще есть
      const janusOpts = await chdb.getJanusForChannel(channelId);

      // удаляем Auth токены из януса для этого пользователя
      await Promise.all([
        janusWorkspaceService.deleteAuthTokenForWorkspace(authToken, janusOpts),
        janusWorkspaceService.manageAuthTokensForChannel('remove', [ channelAuthToken ], janusOpts, channel.janus)
      ]);
    }

    // join socket to conversation room
    this.server.apiEvents.emit('unsubscribe-sockets', {
      room: eventNames.rooms.conversationRoom(channelId),
      sockets: [ socketId ],
    });
  }

  /**
   * Change channel member role
   * @param {string} channelId 
   * @param {string} userId 
   * @param {string} role 
   */
  async changeMemberRole(channelId, userId, role) {
    const {
      channelDatabaseService: chdb,
    } = this.server.services();

    // проверяем что пользователь вообще находится в канале
    const userChannelRelation = await chdb.getChannelMemberRelation(channelId, userId);

    if (!userChannelRelation) {
      throw new Error('UserNotMember');
    }

    // проверяем что в канале останется хотя бы один админ
    if (role === 'user') {
      const channelMembers = await chdb.getAllChannelMembers(channelId);
      const anotherAdmin = channelMembers.filter(u => u.channel_role === 'admin' && u.id !== userId);
      if (anotherAdmin.length === 0) {
        throw new Error('LastAdminInChannel');
      }
    }

    await chdb.updateChannelMemberRelation(channelId, userId, { role });
  }

  /**
   * Generates invite token for specific channel
   * @param {string} channelId Channel id
   * @param {string} userId Who invited
   */
  async getInviteChannelToken(channelId, userId) {
    const {
      inviteCodesDatabaseService: codeService,
      channelDatabaseService: chdb,
      workspaceDatabaseService: wdb,
    } = this.server.services();

    const channel = await chdb.getChannelById(channelId);

    if (!channel) {
      throw new Error('ChannelNotFound');
    }

    const workspace = await wdb.getWorkspaceById(channel.workspace_id);

    if (!workspace) {
      throw new Error('WorkspaceNotFound');
    }

    // check there is already created token
    const alreadyCreatedTokens = await codeService.getActualInvitesByChannel(channelId, 'channelInvite');
    if (alreadyCreatedTokens.length > 0) {
      return alreadyCreatedTokens[0];
    }

    const now = new Date();
    const code = await helpers.generateRandomString(12);

    const info = {
      id: uuid4(),
      code,
      workspace_id: channel.workspace_id,
      channel_id: channelId,
      created_by: userId,
      type: 'channelInvite',
      created_at: now,
      updated_at: now,
      expired_at: new Date(now.getTime() + INVITE_CODE_LIFESPAN)
    };

    await codeService.insertInvite(info);
    return info;
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
    const now = new Date();

    const connection = await connectionService.getConnection(socketId);
    if (!connection) throw new Error('Unknow connection');
    if (!connection.channelId) throw new Error('User hasnt joined any channels');

    // const mainSocket = await chdb.getMainSocketForUser(userId);
    // if (mainSocket !== socketId) throw new Error('Socket arent matched');

    // camera enabled
    if (!connection.mediaState.camera && userMediaState.camera) {
      userMediaState.startCameraTs = now;
    }

    // camera disabled
    if (connection.mediaState.camera && !userMediaState.camera) {
      delete userMediaState.startCameraTs;
    }

    // screen enabled
    if (!connection.mediaState.screen && userMediaState.screen) {
      userMediaState.startScreenTs = now;
    }

    // screen disabled
    if (connection.mediaState.screen && !userMediaState.screen) {
      delete userMediaState.startScreenTs;
    }

    // microphone disabled
    if (connection.mediaState.microphone && !userMediaState.microphone) {
      userMediaState.speaking = false;
    }

    // user starts speaking
    if (!connection.mediaState.speaking && userMediaState.speaking) {
      userMediaState.startSpeakingTs = now;
    }

    const newState = { ...connection.mediaState, ...userMediaState };

    connection.mediaState = newState;
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

  /**
   * Get all media states of user which are currently in the channel
   * @param {string} channelId Channel id
   * @returns {Array<MediaState>} Array of media states (with userId)
   */
  async usersMediaStateInChannel(channelId) {
    const {
      channelDatabaseService: chdb,
      userDatabaseService: udb
    } = this.server.services();

    const users = await chdb.getAllUsersInChannel(channelId);
    const states = await Promise.all(users.map(id => udb.getUserMediaState(id)));
    return states.map((state, index) => ({ ...state, userId: users[index] }));
  }

  /**
   * Updates channel info
   * @param {string} channelId Channel id
   * @param {object} updateInfo Update info
   * @param {?string} updateInfo.name New channel name
   * @param {?string} updateInfo.description Channel description
   * @returns {Channel} new channel object
   */
  async updateChannelInfo(channelId, updateInfo) {
    const {
      channelDatabaseService: chdb,
      apiEventService
    } = this.server.services();

    const channel = await chdb.getChannelById(channelId);

    if (!channel) {
      throw new Error('ChannelNotFound');
    }
    
    const updateObject = {
      ...(updateInfo.name ? { name: updateInfo.name } : {}),
      ...(updateInfo.description ? { description: updateInfo.description } : {})
    };

    if (Object.keys(updateObject).length === 0) {
      return channel;
    }
    
    const updatedChannel = await chdb.updateChannel(channelId, updateObject);

    apiEventService.channelUpdated(channelId, updatedChannel);

    return updatedChannel;
  }

  /**
   * Deletes channel
   * @param {string} channelId Channel id
   */
  async deleteChannel(channelId, updateInfo) {
    const {
      channelDatabaseService: chdb,
      apiEventService
    } = this.server.services();

    const channel = await chdb.getChannelById(channelId);

    if (!channel) {
      throw new Error('ChannelNotFound');
    }

    await chdb.deleteChannel(channelId);

    apiEventService.channelDeleted(channel.workspace_id, channelId);
  }

  /**
   * Delete all invites to the channel and revoke access for the users
   * who accessed channel by these invites
   * @param {string} channelId Channel id
   * @param {boolean} revokeAccess Should access be revoked 
   */
  async deleteAllInvites(channelId, revokeAccess = false) {
    const {
      inviteCodesDatabaseService: invdb,
      workspaceService,
    } = this.server.services();

    const inviteList = await invdb.getInvitesByChannel(channelId, 'channelInvite');

    if (inviteList.length === 0) {
      return;
    }

    if (revokeAccess) {
      await Promise.all(
        inviteList.map(invite => workspaceService.kickUsersFromWorkspaceByInvite(invite))
      );
    }

    await invdb.deleteInvitesByChannel(channelId, 'channelInvite');
  }

};
