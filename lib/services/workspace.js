'use strict';

const Schmervice = require('schmervice');
const uuid4 = require('uuid/v4');
const helpers = require('./helpers');
const eventNames = require('../socket/event_names');

const INVITE_CODE_LIFESPAN = 24 * 60 * 60 * 1000; // a day

module.exports = class WorkspaceService extends Schmervice.Service {

  constructor (...args) {
    super(...args);
  }

  /**
   * Returns information about invite code (expired, info about user who invited
   * and info about workspace)
   * @param {string} fullCode 12 length string
   */
  async getInviteInfo(code) {
    const {
      inviteCodesDatabaseService: codeService,
      userDatabaseService: udb,
      workspaceDatabaseService: wdb
    } = this.server.services();

    const inviteCode = await codeService.getInviteByCode(code);
    if (!inviteCode) {
      return { status: 'NotFound' };
    }
    const now = new Date();
    const expiredDate = new Date(inviteCode.expired_at);
    if (now.getTime() > expiredDate.getTime()) {
      return { status: 'Expired' };
    }

    // get info about workspace and user
    const results = await Promise.all([
      udb.findById(inviteCode.created_by),
      wdb.getWorkspaceById(inviteCode.workspace_id)
    ]);
    return {
      status: 'valid',
      user: results[0],
      workspace: results[1]
    };
  }

  /**
   * Collect full state of the workspace for a certain user
   * @param {string} workspaceId Workspace id
   * @param {string} userId User id
   */
  async getWorkspaceStateForUser(workspaceId, userId) {
    const { 
      workspaceDatabaseService: wdb,
      connectionService
    } = this.server.services();

    const relations = await wdb.getUserWorkspaceRelations(workspaceId, userId);
    if (relations.length === 0) {
      throw new Error('NotPermitted');
    } else if (relations.length > 1) {
      this.server.log(['warn'], `Multiple workspace_members relations: userId(${userId}), workspaceId(${workspaceId})`);
    }

    const relation = relations[0];

    // collect the state
    const [
      workspace,
      channels,
      users
    ] = await Promise.all([
      wdb.getWorkspaceById(workspaceId),
      wdb.getWorkspaceChannelsForUser(workspaceId, userId),
      wdb.getWorkspaceMembersForUser(workspaceId, userId)
    ]);

    const workspaceConnections = await connectionService.getWorkspaceConnections(workspaceId);

    const usersObj = {};
    const channelsObj = {};

    for (let channelIndex in channels) {
      channelsObj[channels[channelIndex].id] = {
        ...channels[channelIndex],
        users: []
      };
    }
    for (let userIndex in users) {
      usersObj[users[userIndex].id] = {
        ...users[userIndex],
        onlineStatus: users[userIndex].online_status || 'offline'
      };
    }

    for (let connIndex in workspaceConnections) {
      const conn = workspaceConnections[connIndex];
      if (conn.channelId && channelsObj[conn.channelId]) {
        channelsObj[conn.channelId].users.push({
          userId: conn.userId,
          ...conn.mediaState
        });
      }
    }

    return {
      workspace,
      relation,
      channels: Object.values(channelsObj),
      users: Object.values(usersObj)
    };
  }

  /**
   * Collect full state of the workspace for a certain user
   * and adds janus statistic here
   * @param {string} workspaceId Workspace id
   * @param {string} userId User id
   */
  async getWorkspaceStateForMonitoring(workspaceId, userId) {
    const {
      workspaceService,
      janusWorkspaceService,
      channelDatabaseService: chdb,
    } = this.server.services();

    const [
      workspaceState,
      janusStats,
    ] = await Promise.all([
      workspaceService.getWorkspaceStateForUser(workspaceId, userId),
      janusWorkspaceService.getJanusStatsForAllServers(),
    ]);

    // filter ненужная info
    workspaceState.users = workspaceState.users.map(u => ({ id: u.id, name: u.name }));
    workspaceState.channels = workspaceState.channels.map(c => ({
      users: c.users,
      id: c.id,
      name: c.name,
      janus: c.janus,
    }));
    delete workspaceState.relation;
    workspaceState.workspace = {
      id: workspaceState.workspace.id,
      name: workspaceState.workspace.name,
    };


    Object.values(janusStats).forEach(sessions => {
      sessions.forEach(session => {
        session.handles.map(h => {
          delete h.sdps;
          if (h.streams) {
            h.streams.forEach(stream => {
              delete stream.extensions;
              delete stream.codecs;
              delete stream.direction;
              if (stream.components) {
                stream.components.forEach(c => {
                  delete c.dtls;
                });
              }
            });
          }
        });
      });
    });

    workspaceState.channels = await Promise.all(workspaceState.channels.map(async ch => {
      const result = { ...ch };

      const janusForChannel = await chdb.getJanusForChannel(ch.id);
      if (!janusForChannel) {
        return ch;
      }

      result.janusDetails = janusForChannel;
      return result;
    }));

    const sessionsByUsers = {};

    Object.keys(janusStats).forEach(serverUrl => {
      if (!sessionsByUsers[serverUrl]) {
        sessionsByUsers[serverUrl] = {};
      }

      janusStats[serverUrl].forEach(session => {
        const handle = session.handles
          .find(h => h.plugin_specific && h.plugin_specific.display);

        if (!handle) {
          return;
        }
        let sessionUserId = handle.plugin_specific.display;
        sessionUserId = sessionUserId.replace('(receiver)', '').replace('(sender)', '');

        if (!sessionsByUsers[serverUrl][sessionUserId]) {
          sessionsByUsers[serverUrl][sessionUserId] = [];
        }

        sessionsByUsers[serverUrl][sessionUserId].push(session);
      });
    });

    workspaceState.channels.forEach(ch => {
      ch.users.forEach(u => {
        if (!sessionsByUsers[ch.janusDetails.publicHttpsUrl][u.userId]) {
          return;
        }
        u.janusStats = sessionsByUsers[ch.janusDetails.publicHttpsUrl][u.userId]
          .map(({id, handles: sessionHandles }) => {
            let name = 'Unknown';
            if (sessionHandles.length === 2
            && sessionHandles.find(h => h.plugin === 'janus.plugin.audiobridge')
            && sessionHandles.find(h => h.plugin === 'janus.plugin.videoroom')) {
              name = 'Main window';
            } else if (sessionHandles.length === 1
            && sessionHandles[0].plugin === 'janus.plugin.textroom') {
              name = 'Frame window';
            }

            return {
              id,
              name,
              handles: Object.values(sessionHandles),
            };
          });
        delete sessionsByUsers[ch.janusDetails.publicHttpsUrl][u.userId];
      });
    });

    return {
      workspaceState,
      undefinedJanusStats: sessionsByUsers,
    };
  }

  /**
   * Creates workspace and return the id
   * @deprecated
   * @param {object} user Object with user info
   * @param {string} name Workspace name
   * @param {string} avatar Avatar uri, optional
   * @returns {object} Workspace object and relation object
   */
  async createWorkspace (user, name, avatar) {
    const { 
      workspaceDatabaseService: wdb,
      channelService
    } = this.server.services();

    // prepare workspace info and create a workspace
    const now = new Date();
    const workspaceInfo = {
      id: uuid4(),
      name,
      avatar,
      limits: {},
      janus: {},
      creator_id: user.id,
      created_at: now,
      updated_at: now
    };
    await wdb.insertWorkspace(workspaceInfo);

    // prepare workspace - user relation and create it
    const workspaceMemberInfo = {
      user_id: user.id,
      workspace_id: workspaceInfo.id,
      role: wdb.roles().admin,
      created_at: now,
      updated_at: now
    };

    // add first workspace member (admin)
    await wdb.addWorkspaceMember(workspaceMemberInfo);

    // add default channels
    await channelService.createDefaultChannels(user, workspaceInfo);

    return {
      workspace: workspaceInfo,
      relation: workspaceMemberInfo
    };
  }

  /**
   * Creates workspace and return created workspace object and relation object
   * 
   * @param {string} userId User id (creator of workspace)
   * @param {object} workspace Workspace info
   * @param {string} workspace.name Name of workspace
   * @param {?string} workspace.avatarFileId Optional avatar of workspace
   */
  async createNewWorkspace(userId, {
    name,
    avatarFileId,
  }) {
    const { 
      workspaceDatabaseService: wdb,
      fileService,
    } = this.server.services();

    // prepare workspace info
    const now = new Date();
    const workspaceInfo = {
      id: uuid4(),
      name,
      creator_id: userId,
      created_at: now,
      updated_at: now
    };

    // check avatarFileId
    if (avatarFileId) {
      const avatarSet = await fileService.getImageSetForOwnedEntity('avatar', userId, avatarFileId);
      workspaceInfo.avatar_set = avatarSet;
      workspaceInfo.avatar_file_id = avatarFileId;
    }
    
    // insert workspace to the database
    await wdb.insertWorkspace(workspaceInfo);

    // add user to workspace as admin
    const relation = await this.addUserToWorkspace(workspaceInfo.id, userId, 'admin');

    // add default channels
    await this.createChannel(workspaceInfo.id, userId, {
      name: 'general',
      isPrivate: false
    });

    return {
      workspace: workspaceInfo,
      relation
    };
  }

  /**
   * Update workspace info
   * @param {string} workspaceId Workspace id
   * @param {object} workspace New workspace information
   * @param {?string} workspace.name New name
   * @param {?string} workspace.avatarFileId New avatar file id 
   */
  async updateWorkspace(workspaceId, {
    name,
    avatarFileId
  }) {
    const {
      fileService,
      workspaceDatabaseService: wdb,
      apiEventService,
    } = this.server.services();

    const workspace = await wdb.getWorkspaceById(workspaceId);

    if (!workspace) {
      throw new Error('NotFound');
    }

    const updateObject = {};

    // update name
    if (name) {
      updateObject.name = name;
    }

    // update avatar
    if (avatarFileId) {
      const avatarSet = await fileService.getImageSetForOwnedEntity('avatar', null, avatarFileId);
      updateObject.avatar_set = avatarSet;
      updateObject.avatar_file_id = avatarFileId;
    } else if (avatarFileId === null && workspace.avatar_file_id) {
      updateObject.avatar_set = {};
      updateObject.avatar_file_id = null;
    }

    if (Object.keys(updateObject).length === 0) {
      return;
    }

    // set new updated_at date
    updateObject.updated_at = new Date();

    // update workspace in the database
    await wdb.updateWorkspace(workspaceId, updateObject);

    // notify all participants about update
    apiEventService.workspaceUpdated(workspaceId, { ...workspace, ...updateObject });

    return { ...workspace, ...updateObject };
  }

  /**
   * Update workspace settings
   * 
   * @param {string} workspaceId Workspace id
   * @param {object} workspace New workspace information
   * @param {?boolean} workspace.canUsersInvite Can any users invite to the workspace
   */
  async updateWorkspaceSettings(workspaceId, {
    canUsersInvite
  }) {

    const {
      workspaceDatabaseService: wdb,
    } = this.server.services();

    const workspace = await wdb.getWorkspaceById(workspaceId);

    if (!workspace) {
      throw new Error('NotFound');
    }

    const updateObject = {};

    // update name
    if (canUsersInvite !== null && canUsersInvite !== undefined) {
      updateObject.can_users_invite = canUsersInvite;
    }

    if (Object.keys(updateObject).length === 0) {
      return;
    }

    // set new updated_at date
    updateObject.updated_at = new Date();

    // update workspace in the database
    await wdb.updateWorkspace(workspaceId, updateObject);

    return { ...workspace, ...updateObject };
  }

  /**
  * Delete workspace
  * 
  * @param {string} workspaceId Workspace id
  * @param {string} name Workspace name
  */
  async deleteWorkspace(workspaceId, name) {
    const {
      workspaceDatabaseService: wdb,
    } = this.server.services();

    const workspace = await wdb.getWorkspaceById(workspaceId);

    if (!workspace) {
      throw new Error('NotFound');
    }

    await wdb.deleteWorkspace(workspaceId);
  }

  /**
   * Creates channel, relation between creator and channel and 
   * relations between all rest members if channel is public
   * @param {string} workspaceId Workspace id
   * @param {string} userId User id
   * @param {object} channel Object with channel info
   */
  async createChannel(workspaceId, userId, channel) {
    const { 
      channelDatabaseService: chdb,
      workspaceDatabaseService: wdb,
      connectionService,
      apiEventService
    } = this.server.services();
    const now = new Date();

    const workspace = await wdb.getWorkspaceById(workspaceId);
    if (!workspace) throw new Error('WorkspaceNotFound');

    const [
      room,
      secret
    ] = await Promise.all([ helpers.getSecureRandomNumber(), helpers.getRandomCode(50) ]);
    
    // Create channel (insert to the database)
    const tmpActiveUntil = channel.lifespan
      ? new Date(Date.now() + channel.lifespan)
      : null;
    const channelInfo = {
      id: uuid4(),
      name: channel.name,
      is_private: channel.isPrivate,
      is_tmp: channel.isTemporary,
      workspace_id: workspaceId,
      creator_id: userId,
      janus: { room, secret }
    };
    if (tmpActiveUntil) {
      channelInfo.tmp_active_until = tmpActiveUntil;
      channelInfo.is_tmp = true;
    }
    if (channel.description) {
      channelInfo.description = channel.description;
    }

    // insert channel to the database
    await chdb.insertChannel(helpers.withTimestamp(channelInfo, now));

    // Insert relation between creator and channel
    const channelCreatorRelation = {
      user_id: userId,
      workspace_id: workspaceId,
      channel_id: channelInfo.id,
      role: chdb.roles().admin
    };

    await chdb.addChannelMembers(helpers.withTimestamp(channelCreatorRelation, now));

    // Insert relations between channel and all worpsace's members
    if (!channelInfo.is_private) {
      await this.addMembersToPublicChannel(channelInfo.id, workspaceId, userId);
    }

    // subscribe users for channel events
    if (!channelInfo.is_private) {
      // if channel is public, subscribe all workspace sockets to channel events
      const allWorkspaceConnections = await connectionService.getWorkspaceConnections(workspaceId);
      this.server.apiEvents.emit('subscribe-sockets', {
        room: eventNames.rooms.channelRoom(channelInfo.id),
        sockets: allWorkspaceConnections.map(c => c.connectionId),
      });
    } else {
      // subscribe only creator
      const creatorConnections = await connectionService.getUserConnections(userId, workspaceId);
      this.server.apiEvents.emit('subscribe-sockets', {
        room: eventNames.rooms.channelRoom(channelInfo.id),
        sockets: creatorConnections.map(c => c.connectionId),
      });
    }

    // Notify users about just created channel
    apiEventService.channelCreated(workspaceId, channelInfo.id);

    return channelInfo;
  }

  /**
   * Creates temporary channel for private talk
   * and invites user to it
   * 
   * @param {string} workspaceId Workspace id
   * @param {string} userId Initiator user id
   * @param {Array<string>} users List of users for private talk
   * @returns {Channel}
   */
  async startPrivateTalk(workspaceId, userId, users) {
    const {
      workspaceDatabaseService: wdb,
      userDatabaseService: udb,
      channelDatabaseService: chdb,
      userService,
    } = this.server.services();

    const now = new Date();
    const workspace = await wdb.getWorkspaceById(workspaceId);

    if (!workspace) {
      throw new Error('NotFound');
    }

    // check if all users in that workspace
    const workspaceUserIds = await wdb.getWorkspaceMemberIds(workspaceId);
    for (let i in users) {
      if (!workspaceUserIds.includes(users[i])) {
        throw new Error('UsersInDifferentWorkspaces');
      }
    }

    // check if there is an already created channel for that users
    if (users.length === 1) {
      const userSet = [userId, ...users].sort().join('');
      const alreadyCreatedChannel = await chdb.getChannelsByUserSet(userSet);

      // return already created channel if it exists
      if (alreadyCreatedChannel.length) {
        return alreadyCreatedChannel[0];
      }
    }

    // create temporary channel
    const [
      room,
      secret
    ] = await Promise.all([ helpers.getSecureRandomNumber(), helpers.getRandomCode(50) ]);
    const channel = helpers.withTimestamp({
      id: uuid4(),
      is_private: true,
      is_tmp: true,
      workspace_id: workspaceId,
      creator_id: userId,
      janus: { room, secret }
    }, now);
    // add user set for channel if there will be only two participants
    if (users.length === 1) {
      channel.user_set = [userId, ...users].sort().join('');
    }
    const channelUsers = await udb.findSeveralUsers([ userId, ...users]); 
    if (channelUsers.length !== users.length + 1) {
      throw new Error('UsersNotExist');
    }
    channel.name = helpers.compilePrivateChannelName(channelUsers, userId);
    await chdb.insertChannel(channel);

    // add users to channel
    await this.addMembersToChannel(channel.id, workspaceId, [ userId, ...users]);

    // send pushes for all participants
    try {
      await Promise.all(users.map(uId => userService.sendInvite({
        fromUserId: userId,
        toUserId: uId,
        isResponseNeeded: true,
        workspaceId: workspaceId,
        channelId: channel.id,
        message: {
          action: 'invite',
          channelId: channel.id,
          isResponseNeeded: true,
        }
      })));
    } catch (e) {
      if (e.message.includes('UserNotConnected')) {
        // ignore
      } else {
        throw (e);
      }
    }

    // Increase calls count between initiator user and called users
    users.forEach(invitedUserId => userService.increaseCallsCountBetweenUsers(userId, invitedUserId, workspaceId));

    return channel;
  }

  /**
   * Deletes channel from janus server
   * Deletes channel from the database
   * Notify all users about the event
   * @param {string} channelId Channel id
   */
  async deleteChannel(channelId) {
    const {
      channelDatabaseService: chdb,
      janusWorkspaceService,
      apiEventService,
      messageDatabaseService: mdb,
      notificationService,
    } = this.server.services();

    // We cant delete channel if there is an active conversation
    const usersInChannel = await chdb.getAllUsersInChannel(channelId);
    if (usersInChannel.length > 0) {
      throw new Error('ActiveConversation');
    }

    const channel = await chdb.getChannelById(channelId);

    if (!channel) {
      return;
    }

    // delete channel from janus server
    const janusOpts = await chdb.getJanusForChannel(channelId);
    if (janusOpts) {
      await janusWorkspaceService.deleteAudioVideoRooms(janusOpts, channel.janus);
      janusWorkspaceService.decrementJanusChannelsFor(janusOpts.name);
    }

    // notify about message cancelled
    // messages will be deleted with channel on CASCADE
    const messages = await mdb.getChannelMessages(channelId);
    const sendPushPromises = [];
    if (messages.length) {

      for (let i in messages) {
        apiEventService.inviteCancelled(messages[i].to_user_id, messages[i].id);

        // Send push notifications to user devices
        sendPushPromises.push(notificationService.sendNotificationToUserDevices(messages[i], {
          event: 'invite-cancelled',
          data: {
            inviteId: messages[i].id,
          }
        }));
      }
    }
    await sendPushPromises;

    // delete channel from the database
    await chdb.deleteChannel(channelId);

    // notify all users that channel was deleted
    apiEventService.channelDeleted(channel.workspace_id, channelId);
  }

  /**
   * Creates relation between just created public channel and
   * all members of a workspace
   * @param {string} channelId Channel id
   * @param {string} workspaceId Workspace id
   * @param {string} creatorId id of admin user
   */
  async addMembersToPublicChannel(channelId, workspaceId, creatorId) {
    const { 
      workspaceDatabaseService: wdb,
      channelDatabaseService: chdb
    } = this.server.services();
    const now = new Date();

    const workspace = await wdb.getWorkspaceById(workspaceId);
    const channel = await chdb.getChannelById(channelId);
    if (!workspace) {
      throw new Error('WorkspaceNotFound');
    }
    if (!channel) {
      throw new Error('ChannelNotFound');
    }

    const workspaceMembers = (await wdb.getWorkspaceMembers(workspaceId))
      .filter(user => user.id !== creatorId); // get rid of admin

    const relations = await Promise.all(workspaceMembers.map(async user => {
      return {
        user_id: user.id,
        workspace_id: workspaceId,
        channel_id: channelId,
        role: chdb.roles().user,
        created_at: now,
        updated_at: now
      };
    }));

    if (!relations.length) return [];

    await chdb.addChannelMembers(relations);
    return relations;
  }

  /**
   * Adds the specified users to the channel
   * @param {string} channelId Channel id
   * @param {string} workspaceId Workspace id
   * @param {Array<string>} memberList List of users that should be included to the channel
   */
  async addMembersToChannel(channelId, workspaceId, memberList) {
    const { 
      workspaceDatabaseService: wdb,
      channelDatabaseService: chdb,
      apiEventService,
      connectionService
    } = this.server.services();
    const now = new Date();

    const workspace = await wdb.getWorkspaceById(workspaceId);
    const channel = await chdb.getChannelById(channelId);
    if (!workspace) {
      throw new Error('WorkspaceNotFound');
    }
    if (!channel) {
      throw new Error('ChannelNotFound');
    }

    const workspaceMembers = (await wdb.getWorkspaceMembers(workspaceId));

    // filter only that users that are in the workspace
    const attachedUsers = workspaceMembers.filter(user => memberList.includes(user.id));


    const relations = await Promise.all(attachedUsers.map(async user => {
      return {
        user_id: user.id,
        workspace_id: workspaceId,
        channel_id: channelId,
        role: chdb.roles().user,
        created_at: now,
        updated_at: now
      };
    }));

    if (!relations.length) return [];

    await chdb.addChannelMembers(relations);

    // notify workspace about new channel one more time
    // for new participants
    memberList.forEach(userId => {
      apiEventService.channelCreatedForUser(userId, channelId, workspaceId);
    });

    // subscribe all participants sockets for event of this channel
    const connections = await Promise.all(memberList.map(userId => {
      return connectionService.getUserConnections(userId, workspaceId);
    }));
    this.server.apiEvents.emit('subscribe-sockets', {
      sockets: connections.reduce((p, c) => [...p, ...c], []).map(conn => conn.connectionId),
      room: eventNames.rooms.channelRoom(channelId)
    });

    return relations;
  }

  /**
   * Change member role in workspace
   * 
   * @param {string} workspaceId 
   * @param {string} userId 
   * @param {('admin'|'user')} role 
   */
  async changeMemberRole(workspaceId, userId, role) {
    const {
      workspaceDatabaseService: wdb,
    } = this.server.services();

    const workspace = await wdb.getWorkspaceById(workspaceId);

    if (!workspace) {
      throw new Error('NotFound');
    }

    const relations = await wdb.getUserWorkspaceRelations(workspaceId, userId);

    // user is not workpsace member
    if (relations.length === 0) {
      return await this.addUserToWorkspace(workspaceId, userId, role);
    }

    // role does not change
    if (relations[0].role === role) {
      return;
    }

    // change admin to user
    if (relations[0].role === 'admin' && role === 'user') {
      if (workspace.creator_id === userId) {
        throw new Error('CantDemoteCreator');
      }

      await wdb.updateUserWorkspaceRelation(workspaceId, userId, { role: 'user' });
    }

    // change user to admin
    if (relations[0].role === 'user' && role === 'admin') {
      await wdb.updateUserWorkspaceRelation(workspaceId, userId, { role: 'admin' });
    }
  }

  /**
   * Kick user from the channel
   * Deletes channel if user was the last in it
   * Revokes janus token for that user
   * @param {string} channelId Channel id
   * @param {string} userId User id
   */
  async kickUserFromChannel(channelId, userId) {
    const {
      channelDatabaseService: chdb,
      connectionService,
      channelService,
      apiEventService,
    } = this.server.services();
    let relation = await chdb.getChannelMemberRelation(channelId, userId);

    // Has the user active conversation in that channel
    const connections = await connectionService.getUserConnections(userId, relation.workspace_id);
    for (let i in connections) {
      if (connections[i].channelId) {
        await channelService.unselectChannel(
          connections[i].channelId,
          userId,
          connections[i].connectionId
        );
      }
    }

    // Delete channel if user was the last user in it
    const members = await chdb.getAllChannelMembers(channelId);
    if (members.length === 1 && members[0].id === userId) {
      await this.deleteChannel(channelId);
      return;
    }

    // delete relation between user and channel
    await chdb.deleteChannelMember(channelId, userId);

    // unsubscribe user sockets from this channel
    this.server.apiEvents.emit('unsubscribe-sockets', {
      sockets: connections.map(c => c.connectionId),
      room: eventNames.rooms.channelRoom(channelId),
    });

    // notify all users that channel was deleted
    apiEventService.channelDeletedForUser(userId, relation.workspace_id, channelId);
  }

  /**
   * Add the user to the workspace
   * Notify all workspace members about new user
   * If role is not guest, add the user to all public channels
   * If role is guest, add the user only to channel specified in arguments
   * @param {string} workspaceId Workspace id 
   * @param {string} userId User id
   * @param {string} role Admin, moderator, user, guest 
   * @param {?Array<string>} channels Array of channels that user should be added to
   * @param {?string} inviteId Invite id
   */
  async addUserToWorkspace(workspaceId, userId, role = 'user', channels = [], inviteId = null) {
    const {
      workspaceDatabaseService: wdb,
      userDatabaseService: udb,
      channelDatabaseService: chdb,
      apiEventService
    } = this.server.services();
    const now = new Date();

    const workspace = await wdb.getWorkspaceById(workspaceId);

    if (!workspace) {
      throw new Error('WorkspaceNotFound');
    }

    const [ existingRelation ] = await wdb.getUserWorkspaceRelations(workspaceId, userId);

    if (existingRelation) {
      return;
    }

    const relation = {
      user_id: userId,
      workspace_id: workspaceId,
      role,
      created_at: now,
      updated_at: now,
      invite_id: inviteId,
    };

    const user = await udb.findById(userId);
    await wdb.addWorkspaceMember(relation);

    // notify all workspace members about new user
    apiEventService.userJoined(workspaceId, user);

    // if role is not guest, select all public channels
    if (role !== wdb.roles().guest) {
      channels = (await wdb.getWorkspaceChannels(workspaceId))
        .filter(channel => !channel.is_private)
        .map(channel => channel.id);
    }

    // do nothing if channels array is empty
    if (channels.length) {
      // add relations between selected channels and the user
      const relations = await Promise.all(
        channels.map(async channelId => ({
          user_id: userId,
          channel_id: channelId,
          workspace_id: workspaceId,
          role: chdb.roles().user,
          created_at: now,
          updated_at: now,
          invite_id: inviteId,
        }))
      );

      await chdb.addChannelMembers(relations);
    }

    // notify added user about new workspace
    apiEventService.workspaceAdded(userId, workspace, relation);

    return relation;
  }

  /**
   * Deletes user from the workspace, delete janus auth token
   * deletes relations between all channels and the workspace
   * @param {string} workspaceId Workspace id
   * @param {string} userId User id
   */
  async kickUserFromWorkspace(workspaceId, userId) {
    const {
      workspaceDatabaseService: wdb,
      channelService,
      apiEventService,
      connectionService
    } = this.server.services();

    const workspace = await wdb.getWorkspaceById(workspaceId);

    if (!workspace) {
      throw new Error('NotFound');
    }

    if (workspace.creator_id === userId) {
      throw new Error('CantKickCreator');
    }

    // Are there another admins in the workspace
    const anotherAdmins = await wdb.getAdminsExceptUserId(workspaceId, userId);
    if (anotherAdmins.length === 0) {
      throw new Error('LastAdmin');
    }

    // Has the user active converation?
    // Kick user from these channels
    const connections = await connectionService.getUserConnections(userId, workspaceId);
    for (let connIndex in connections) {
      if (connections[connIndex].channelId) {
        await channelService.unselectChannel(
          connections[connIndex].channelId,
          userId,
          connections[connIndex].connectionId
        );
      }
    }

    // We have to kick user from all workspace channels
    const userChannels = await wdb.getWorkspaceChannelsForUser(workspaceId, userId);
    await Promise.all(userChannels.map(channel => this.kickUserFromChannel(channel.id, userId)));

    // delete relation between user and workspace
    await wdb.deleteWorkspaceMember(workspaceId, userId);

    // notify all workspaceMembers about user leaved
    apiEventService.userLeavedWorkspace(workspaceId, userId);

    // Notify user about he kicked from workspace
    apiEventService.userKickedFromWorkspace(userId, workspaceId);

    // disconnect all user connections that are related to the workspace
    const workspaceRelatedConnections = connections.filter(conn => conn.workspaceId === workspaceId);
    if (workspaceRelatedConnections.length) {
      workspaceRelatedConnections.forEach(conn => this.server.apiEvents.emit('disconnect', conn.connectionId));
    }
  }

  /**
   * Kick all users from workspace by the invite
   * @param {object|string} invite Invite object or invite id
   */
  async kickUsersFromWorkspaceByInvite(invite) {
    const {
      inviteCodesDatabaseService: invdb,
      workspaceDatabaseService: wdb,
    } = this.server.services();

    if (typeof invite === 'string') {
      invite = await invdb.getInviteById(invite);
    }

    // gather all users who signed up with this invite
    const inviteRelations = await wdb.getWorkspaceRelationsByInvite(invite.workspace_id, invite.id);

    if (inviteRelations.length === 0) {
      return;
    }

    await Promise.all(
      inviteRelations.map(rel => this.kickUserFromWorkspace(rel.workspace_id, rel.user_id))
    );
  }

  /**
   * Creates invite to the workspace
   * @param {string} workspaceId Workspace id
   * @param {string} userId User id
   * @returns {object} fullCode and code info
   */
  async inviteToWorkspace(workspaceId, userId) {
    const {
      inviteCodesDatabaseService: codeService
    } = this.server.services();
    const now = new Date();
    const code = await helpers.generateRandomString(12);

    const info = {
      id: uuid4(),
      code,
      workspace_id: workspaceId,
      created_by: userId,
      created_at: now,
      updated_at: now,
      expired_at: new Date(now.getTime() + INVITE_CODE_LIFESPAN)
    };

    await codeService.insertInvite(info);
    return code;
  }

  /**
   * Start process of connecting slack and Heyka workspaces
   * Returns operation id (slack state)
   * @param {string} workspaceId Workspace id
   */
  async initiateSlackConnecting(workspaceId) {
    const { userDatabaseService } = this.server.services();
    const operationId = uuid4();
    await userDatabaseService.saveSlackState(operationId, {
      workspaceId,
      operation: 'connecting'
    });
    return operationId;
  }

  /**
   * Finish connecting slack after user gave access to the workspace
   * @param {string} state Slack state (operation id)
   * @param {string} code Slack access code
   */
  async finishSlackConnecting(state, code) {
    const {
      userDatabaseService,
      slackService,
      workspaceDatabaseService
    } = this.server.services();
    const slackState = await userDatabaseService.getSlackState(state);
    if (!slackState) {
      throw new Error('OperationNotFound');
    }
    const workspace = await workspaceDatabaseService.getWorkspaceById(slackState.workspaceId);
    const slackAccessDetails = await slackService.gainAccessTokenByOAuthCode(code);

    // check that this workspace has not already attached to heyka workspace
    const attachedWorkspace = await workspaceDatabaseService.getWorkspaceBySlackId(slackAccessDetails.team.id);

    if (attachedWorkspace) {
      throw new Error('WorkspaceAlreadyAttached');
    }

    await workspaceDatabaseService.updateWorkspace(slackState.workspaceId, {
      slack: slackAccessDetails
    });

    return {
      slackWorkspaceName: slackAccessDetails.team.name,
      workspaceName: workspace.name,
    };
  }

  /**
   * start loop for gathering janus stats
   */
  async initMonitoringLoop(workspaceId) {
    const HISTORY_PERIOD = 30 * 60 * 1000;
    const SNAPSHOT_INTERVAL = 1000;
    const db = this.server.plugins['hapi-pg-promise'].db;
    let processing = false;

    // find creator of this id
    const workspace = await db.oneOrNone('SELECT * FROM workspaces WHERE id=$1', [workspaceId]);

    if (!workspace) {
      console.warn('Workspace for monitoring NOT FOUND');
      return;
    }

    setInterval(async () => {
      if (processing) {
        const s = Math.floor(SNAPSHOT_INTERVAL / 10) / 100;
        console.warn(`Getting full workspace state with janus stats got more than ${s} second(s)`);
        return;
      }

      processing = true;
      try {
        const stats = await this.getWorkspaceStateForMonitoring(workspaceId, workspace.creator_id);
  
        const record = {
          id: uuid4(),
          workspace_id: workspaceId,
          body: JSON.stringify(stats),
          created_at: new Date(),
        };
  
        await db.result('INSERT INTO janus_stats(${this:name}) VALUES(${this:csv})', record);
        // delete old records
        await db.result(
          'DELETE FROM janus_stats WHERE created_at < $1 AND (do_not_delete IS NULL OR do_not_delete = FALSE)',
          [new Date(Date.now() - HISTORY_PERIOD)]
        );
      } catch(e) {
        console.warn('An error occured during insert and delete stats', e);
      }
      processing = false;
    }, SNAPSHOT_INTERVAL);
  }
  
  /*
   * Detach slack from workspace
   * @param {string} workspaceId
   */
  async detachSlack (workspaceId) {
    const {
      workspaceDatabaseService: wdb,
    } = this.server.services();
    await wdb.updateWorkspace(workspaceId, {
      slack: {}
    });
  }
};
