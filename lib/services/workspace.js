'use strict';

const Schmervice = require('schmervice');
const uuid4 = require('uuid/v4');
const helpers = require('./helpers');
const eventNames = require('../socket/event_names');
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
   * Creates workspace and return the id
   * @param {object} user Object with user info
   * @param {string} name Workspace name
   * @returns {object} Workspace object
   */
  async createWorkspace (user, name) {
    const { 
      janusWorkspaceService,
      workspaceDatabaseService: wdb,
      channelService
    } = this.server.services();

    // prepare workspace info and create a workspace
    const now = new Date();
    const workspaceInfo = {
      id: uuid4(),
      name,
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
    await wdb.addWorkspaceMember(workspaceMemberInfo);
  
    // add default channels
    await channelService.createDefaultChannels(user, workspaceInfo);

    // create janus server for the workspace
    const janusInfo = await janusWorkspaceService.createServer();

    // keep janus info in the workspace
    return await wdb.updateWorkspace(workspaceInfo.id, { janus: janusInfo });
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
      janusWorkspaceService
    } = this.server.services();
    const now = Date.now();

    const workspace = await wdb.getWorkspaceById(workspaceId);
    if (!workspace) throw new Error('WorkspaceNotFound');
    
    // Create channel (insert to the database)
    const channelInfo = {
      id: uuid4(),
      name: channel.name,
      is_private: channel.isPrivate,
      workspace_id: workspaceId,
      creator_id: userId,
      janus: {}
    };

    // create channel in Janus first
    const result = await janusWorkspaceService.createAudioVideoRooms(channelInfo.id, workspace.janus);
    channelInfo.janus.audioRoomId = result.audioRoomId;
    channelInfo.janus.videoRoomId = result.videoRoomId;

    // insert channel to the database
    await chdb.insertChannel(helpers.withTimestamp(channelInfo));

    // Insert relation between creator and channel
    const channelCreatorRelation = {
      user_id: userId,
      workspace_id: workspaceId,
      channel_id: channelInfo.id,
      role: chdb.roles().admin
    };

    await chdb.addChannelMembers(helpers.withTimestamp(channelCreatorRelation, now));

    // Insert relations between channel and all worpsace's members
    let relations = [];
    if (!channelInfo.isPrivate) {
      relations = await this.addMembersToPublicChannel(channelInfo.id, workspaceId, userId);
    }

    // Notify users about just created channel
    const notifiedUserIdList = relations.map(relation => relation.user_id);
    notifiedUserIdList.push(userId); // add creator to the list
    this.server.apiEvents.emit(eventNames.server.channelCreated, {
      users: notifiedUserIdList,
      channel: channelInfo
    });

    return channelInfo;
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
    const now = Date.now();

    const workspaceMembers = (await wdb.getWorkspaceMembers(workspaceId))
      .filter(user => user.id !== creatorId); // get rid of admin

    const relations = workspaceMembers.map(user => helpers.withTimestamp({
      user_id: user.id,
      workspace_id: workspaceId,
      channel_id: channelId,
      role: chdb.roles().user
    }, now));

    if (!relations.length) return [];

    await chdb.addChannelMembers(relations);
    return relations;
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
      channelDatabaseService: chdb
    } = this.server.services();
    const now = new Date();

    const relation = {
      user_id: userId,
      workspace_id: workspaceId,
      role,
      created_at: now,
      updated_at: now
    };

    const workspaceMembers = await wdb.getWorkspaceMembers(workspaceId);
    const user = await udb.findById(userId);
    await wdb.addWorkspaceMember(relation);

    // notify all workspace members about new user
    this.server.apiEvents.emit(eventNames.server.userJoined, {
      joinedUser: user,
      users: workspaceMembers.map(user => user.id)
    });

    // if role is not guest, select all public channels
    if (role !== wdb.roles().guest) {
      channels = (await wdb.getWorkspaceChannels(workspaceId))
        .filter(channel => !channel.is_private);
    }

    // do nothing if channels array is empty
    if (!channels.length) return;

    // add relations between selected channels and the user
    const relations = channels.map(channel => ({
      user_id: userId,
      channel_id: channel.id,
      workspace_id: workspaceId,
      role: chdb.roles().user,
      created_at: now,
      updated_at: now
    }));

    await chdb.addChannelMembers(relations);
    return;
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
