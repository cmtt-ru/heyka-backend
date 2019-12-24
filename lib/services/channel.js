'use strict';

const Schmervice = require('schmervice');
const uuid4 = require('uuid/v4');

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
    const { channelDatabaseService: chdb } = this.server.services();
    const now = new Date();

    // add default channels for the workspace
    const channelInfo = {
      id: uuid4(),
      name: 'general',
      is_private: false,
      created_at: now,
      updated_at: now,
      workspace_id: workspace.id,
      creator_id: user.id
    };
    await chdb.insertChannel(channelInfo);

    // add a relation between channel and creator
    const channelMemberInfo = {
      user_id: user.id,
      workspace_id: workspace.id,
      channel_id: channelInfo.id,
      role: chdb.roles().admin
    };
    await chdb.addChannelMembers(channelMemberInfo);
  }
};
