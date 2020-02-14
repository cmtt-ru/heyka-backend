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
      janus: {}
    };

    // create audio and video room in janus
    const result = await janusWorkspaceService.createAudioVideoRooms(
      channelInfo.id,
      workspace.janus
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
      || relation.role === roles.user
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
      channelDatabaseService: chdb
    } = this.server.services();

    const janusAuthToken = await helpers.getRandomCode(50);
    await chdb.updateChannelMemberRelation(channelId, userId, {
      janus_auth_token: janusAuthToken
    });

    if (!relation) {
      throw new Error('There are not relations between that user and channel');
    }

    return janusAuthToken;
  }

  async switchChannelForUser(channelId, userId) {
    const {
      channelDatabaseService: chdb
    } = this.server.services();
    const channel = await chdb.getChannelById(channelId);
    if (!channel) {
      throw new Error('ChannelNotFound');
    }
    // generate token and add token to janus
    const token = await this.grantChannelTokenForUser(channelId, userId);
    // switch user's channel in the database
    const previousChannelId = await chdb.switchUserToChannel(channelId, userId);

    // disable token for previous channel id
    if (previousChannelId) {

    }
    
    // prepare a list who should be notified about it
    const users = (await chdb.getAllChannelMembers(channelId)).map(user => user.id);
    if (users.length > 0) {
      this.server.apiEvents.emit(eventNames.server.userSwitchesChannel, {
        data: {
          userId,
          channelId
        },
        users
      });
    }
  }
};
