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
   */
  async selectChannel(channelId, userId) {
    const {
      channelDatabaseService: chdb,
      workspaceDatabaseService: wdb
    } = this.server.services();

    const oldChannelId = await chdb.switchUserToChannel(channelId, userId);
    const newChannel = await chdb.getChannelById(channelId);
    const oldChannel = await chdb.getChannelById(oldChannelId);

    let workspaceMembers = null;
    // notify about that user unselected old channel
    if (oldChannelId) {
      let unselectNotifiedUsers = null;
      if (oldChannel.is_private) {
        const channelMembers = await chdb.getAllChannelMembers(oldChannelId);
        unselectNotifiedUsers = channelMembers.map(u => u.id);
      } else {
        workspaceMembers = await wdb.getWorkspaceMembers(oldChannel.workspace_id);
        workspaceMembers = workspaceMembers.map(u => u.id);
        unselectNotifiedUsers = workspaceMembers;
      }
      this.server.apiEvents.emit(eventNames.server.userUnselectedChannel, {
        channelId: oldChannelId,
        userId,
        users: unselectNotifiedUsers
      });
    }

    // notify about that user selected new channel
    let selectNotifiedUsers = null;
    if (newChannel.is_private) {
      const channelMembers = await chdb.getAllChannelMembers(newChannel.id);
      selectNotifiedUsers = channelMembers.map(u => u.id);
    } else {
      if (!workspaceMembers) {
        workspaceMembers = await wdb.getWorkspaceMembers(newChannel.workspace_id);
        workspaceMembers = workspaceMembers.map(u => u.id);
      }
      selectNotifiedUsers = workspaceMembers;
    }
    this.server.apiEvents.emit(eventNames.server.userSelectedChannel, {
      channelId: newChannel.id,
      userId,
      users: selectNotifiedUsers
    });
  }
};
