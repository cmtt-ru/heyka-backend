'use strict';

const Schmervice = require('schmervice');
const uuid4 = require('uuid/v4');
const helpers = require('./helpers');
const eventNames = require('../socket/event_names');

module.exports = class WorkspaceService extends Schmervice.Service {

  constructor (...args) {
    super(...args);
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
   * Adds the user to the workspace
   * @param {uuid} workspaceId Workspace id
   * @param {uuid} userId User id
   * @param {string} role Role (admin, moderator, user, guest)
   */
  async addUserToWorkspace (workspaceId, userId, role) {
    const { workspaceDatabaseService: wdb } = this.server.services();
    const roles = Object.values(wdb.roles());
    if (!roles.includes(role)) {
      throw new Error('"Role" argument should be one of ' + roles.toString());
    }
    const now = new Date();
    const relationInfo = {
      user_id: userId,
      workspace_id: workspaceId,
      role,
      created_at: now,
      updated_at: now
    };
    await wdb.addWorkspaceMember(relationInfo);
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
    channelInfo.janus.audioRoomId = result.audioRoomId
    channelInfo.janus.videoRoomId = result.videoRoomId

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
};
