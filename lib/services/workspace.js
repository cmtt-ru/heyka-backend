'use strict';

const Schmervice = require('schmervice');
const uuid4 = require('uuid/v4');
const helpers = require('./helpers');
const crypto = require('crypto-promise');

const INVITE_CODE_LIFESPAN = 24 * 60 * 60 * 1000; // a day

module.exports = class WorkspaceService extends Schmervice.Service {

  constructor (...args) {
    super(...args);
  }

  /**
   * Returns information about invite code (expired, info about user who invited
   * and info about workspace)
   * @param {string} fullCode 82 length string (full invite code)
   */
  async getInviteInfo(fullCode) {
    const {
      inviteCodesDatabaseService: codeService,
      userDatabaseService: udb,
      workspaceDatabaseService: wdb
    } = this.server.services();

    // Код состоит из guid + code, первые 32 символа - это guid, остальные 50 - это код
    let codeId = fullCode.substr(0, 32);
    codeId = `${codeId.slice(0,8)}-${codeId.slice(8,12)}`
      + `-${codeId.slice(12,16)}-${codeId.slice(16, 20)}`
      + `-${codeId.slice(20,32)}`;
    const code = fullCode.substr(32, 50);

    const inviteCode = await codeService.getInviteById(codeId);
    if (!inviteCode) {
      return { status: 'NotFound' };
    }
    const now = new Date();
    const expiredDate = new Date(inviteCode.expired_at);
    if (now.getTime() > expiredDate.getTime()) {
      return { status: 'Expired' };
    }
    if (inviteCode.code !== code) {
      return { status: 'NotMatched' };
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
      wdb.getWorkspaceMembers(workspaceId)
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
        onlineStatus: 'offline'
      };
    }

    for (let connIndex in workspaceConnections) {
      const conn = workspaceConnections[connIndex];
      if (conn.channelId) {
        channelsObj[conn.channelId].users.push({
          userId: conn.userId,
          ...conn.mediaState
        });
      }
      if (conn.onlineStatus !== 'offline') {
        if (usersObj[conn.userId].onlineStatus === 'offline') {
          usersObj[conn.userId].onlineStatus = conn.onlineStatus;
          usersObj[conn.userId].timeZone = conn.timeZone;
        } else if (usersObj[conn.userId].onlineStatus === 'idle' && conn.onlineStatus === 'online') {
          usersObj[conn.userId].onlineStatus = conn.onlineStatus;
          usersObj[conn.userId].timeZone = conn.timeZone;
        }
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
   * Creates workspace and return the id
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
   * Whether a user can create channels in a certain workspace
   * @param {uuid} workspaceId Workspace id
   * @param {uuid} userId User id
   * @returns {boolean}
   */
  async canCreateChannel(workspaceId, userId) {
    const { 
      workspaceDatabaseService: wdb
    } = this.server.services();

    const relations = await wdb.getUserWorkspaceRelations(workspaceId, userId);
    if (relations.length === 0) {
      return false;
    } else if (relations.length > 1) {
      this.server.log(['warn'], `Multiple workspace_members relations: userId(${userId}), workspaceId(${workspaceId})`);
    }

    const role = relations[0].role;
    return role === wdb.roles().admin || role === wdb.roles().moderator || role === wdb.roles().user;
  }

  /**
   * Whether a user can invite to workspace
   * @param {uuid} workspaceId Workspace id
   * @param {uuid} userId User id
   * @returns {boolean}
   */
  async canInviteToWorkspace(workspaceId, userId) {
    const { 
      workspaceDatabaseService: wdb
    } = this.server.services();

    const relations = await wdb.getUserWorkspaceRelations(workspaceId, userId);
    if (relations.length === 0) {
      return false;
    } else if (relations.length > 1) {
      this.server.log(['warn'], `Multiple workspace_members relations: userId(${userId}), workspaceId(${workspaceId})`);
    }

    const role = relations[0].role;
    return role === wdb.roles().admin || role === wdb.roles().moderator || role === wdb.roles().user;
  }

  /**
   * Whether a user can subscrube for workspace events
   * @param {uuid} workspaceId Workspace id
   * @param {uuid} userId User id
   * @returns {boolean}
   */
  async canSubscribeForWorkspaceEvents(workspaceId, userId) {
    const { 
      workspaceDatabaseService: wdb
    } = this.server.services();

    const relations = await wdb.getUserWorkspaceRelations(workspaceId, userId);
    if (relations.length === 0) {
      return false;
    } else if (relations.length > 1) {
      this.server.log(['warn'], `Multiple workspace_members relations: userId(${userId}), workspaceId(${workspaceId})`);
    }
    return true;
  }

  /**
   * Can user connect slack workspace to heyka workspace?
   * Returns true/false
   * @param {string} workspaceId
   * @param {string} userId 
   */
  async canConnectSlack(workspaceId, userId) {
    const { 
      workspaceDatabaseService: wdb
    } = this.server.services();

    const relations = await wdb.getUserWorkspaceRelations(workspaceId, userId);
    if (relations.length === 0) {
      return false;
    } else if (relations.length > 1) {
      this.server.log(['warn'], `Multiple workspace_members relations: userId(${userId}), workspaceId(${workspaceId})`);
    }

    const role = relations[0].role;
    return role === wdb.roles().admin;
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
      apiEventService
    } = this.server.services();
    const now = new Date();

    const workspace = await wdb.getWorkspaceById(workspaceId);
    if (!workspace) throw new Error('WorkspaceNotFound');
    
    // Create channel (insert to the database)
    const tmpActiveUntil = channel.lifespan
      ? new Date(Date.now() + channel.lifespan)
      : null;
    const channelInfo = {
      id: uuid4(),
      name: channel.name,
      is_private: channel.isPrivate,
      workspace_id: workspaceId,
      creator_id: userId,
      janus: {}
    };
    if (tmpActiveUntil) {
      channelInfo.tmp_active_until = tmpActiveUntil;
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

    // Notify users about just created channel
    apiEventService.channelCreated(workspaceId, channelInfo.id);

    return channelInfo;
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
      apiEventService
    } = this.server.services();

    // We cant delete channel if there is an active conversation
    const usersInChannel = await chdb.getAllUsersInChannel(channelId);
    if (usersInChannel.length > 0) {
      throw new Error('ActiveConversation');
    }

    // delete channel from janus server
    const janusOpts = await chdb.getJanusForChannel(channelId);
    if (janusOpts) {
      await janusWorkspaceService.deleteAudioVideoRooms(janusOpts);
      janusWorkspaceService.decrementJanusChannelsFor(janusOpts.name);
    }

    // delete channel from the database
    const channel = await chdb.getChannelById(channelId);
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
    return relations;
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
      connectionService
    } = this.server.services();
    let relation = await chdb.getChannelMemberRelation(channelId, userId);

    // Has the user active conversation in that channel
    const connections = await connectionService.getUserConnections(userId, relation.workspace_id);
    for (let i in connections) {
      if (connections[i].channelId) {
        throw new Error('ActiveConversation');
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
  }

  /**
   * Add the user to the workspace
   * Notify all workspace members about new user
   * If role is not guest, add the user to all public channels
   * If role is guest, add the user only to channel specified in arguments
   * @param {string} workspaceId Workspace id 
   * @param {string} userId User id
   * @param {string} role Admin, moderator, user, guest 
   */
  async addUserToWorkspace(workspaceId, userId, role = 'user', channels = []) {
    const {
      workspaceDatabaseService: wdb,
      userDatabaseService: udb,
      channelDatabaseService: chdb,
      apiEventService
    } = this.server.services();
    const now = new Date();

    const relation = {
      user_id: userId,
      workspace_id: workspaceId,
      role,
      created_at: now,
      updated_at: now
    };

    const user = await udb.findById(userId);
    await wdb.addWorkspaceMember(relation);

    // notify all workspace members about new user
    apiEventService.userJoined(workspaceId, user);

    // if role is not guest, select all public channels
    if (role !== wdb.roles().guest) {
      channels = (await wdb.getWorkspaceChannels(workspaceId))
        .filter(channel => !channel.is_private);
    }

    // do nothing if channels array is empty
    if (!channels.length) return;
    // add relations between selected channels and the user
    const relations = await Promise.all(
      channels.map(async channel => ({
        user_id: userId,
        channel_id: channel.id,
        workspace_id: workspaceId,
        role: chdb.roles().user,
        created_at: now,
        updated_at: now
      }))
    );

    await chdb.addChannelMembers(relations);
    return;
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
      apiEventService,
      connectionService
    } = this.server.services();

    // Has the user active converation?
    const connections = await connectionService.getUserConnections(userId, workspaceId);
    for (let connIndex in connections) {
      if (connections[connIndex].channelId) {
        throw new Error('ActiveConversation');
      }
    }

    // Are there another admins in the workspace
    const anotherAdmins = await wdb.getAdminsExceptUserId(workspaceId, userId);
    if (anotherAdmins.length === 0) {
      throw new Error('LastAdmin');
    }

    // We have to kick user from all workspace channels
    const userChannels = await wdb.getWorkspaceChannelsForUser(workspaceId, userId);
    await Promise.all(userChannels.map(channel => this.kickUserFromChannel(channel.id, userId)));

    // delete auth token for that user from the janus
    let relation = await wdb.getUserWorkspaceRelations(workspaceId, userId);
    if (relation.length > 1) { 
      this.server.log(['warn'], `There are several relations between u:${userId} and w:${workspaceId}`);
    }
    relation = relation[0];

    // delete relation between user and workspace
    await wdb.deleteWorkspaceMember(workspaceId, userId);

    // notify all workspaceMembers about user leaved
    apiEventService.userLeavedWorkspace(workspaceId, userId);
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
    const code = (await crypto.randomBytes(25)).toString('hex');

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
    return {
      fullCode: `${info.id.replace(/-/g, '')}${info.code}`,
      code: info
    };
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
    const slackAccessDetails = await slackService.gainAccessTokenByOAuthCode(code);
    await workspaceDatabaseService.updateWorkspace(slackState.workspaceId, {
      slack: slackAccessDetails
    });
  }
};
