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
   * @returns {object} Janus connection options
   */
  async selectChannel(channelId, userId, socketId, userMediaState) {
    const {
      apiEventService,
      connectionService,
      channelDatabaseService: chdb,
      janusWorkspaceService
    } = this.server.services();

    const conn = await connectionService.getConnection(socketId);
    if (!conn) {
      console.log('connections is not existed');
      return;
    }
    if (!conn) return;
    if (conn.channelId === channelId) return;

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

    return {
      url: janus.publicUrl,
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
      throw new Error('ChannelAlreadyDeleted');
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
      const channel = await chdb.getChannelById(channelId);

      // удаляем канал, если он был временный
      if (channel && channel.is_tmp) {
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
    if (!connection) throw new Error('Unknow connection');
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
