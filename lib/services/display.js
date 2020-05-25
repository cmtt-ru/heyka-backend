'use strict';

const Schmervice = require('schmervice');
const isNull = v => v === null || v === undefined;

module.exports = class DisplayService extends Schmervice.Service {
  constructor(...args) {
    super(...args);
  }

  /**
   * Format raw user data in secure way
   * @param {Object} user User object
   * @returns {object} Secure object
   */
  user (user) {
    return {
      id: user.id,
      name: user.name,
      avatar: !isNull(user.avatar) ? user.avatar: undefined,
      email: user.email,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      isEmailVerified: user.is_email_verified
    };
  }

  /**
   * Format raw user data in secure way and add confidential data to id
   * @param {object} userData User object
   * @returns {object} Secure object with confidential data
   */
  userWithConfidentialData(userData) {
    const tmpUser = this.user(userData);
    if (userData.auth.facebook) {
      tmpUser.facebookAuth = {
        id: userData.auth.facebook.id
      };
    }
    if (userData.auth.google) {
      tmpUser.googleAuth = {
        id: userData.auth.google.id
      };
    }
    if (userData.auth.slack) {
      tmpUser.slackAuth = {
        id: userData.auth.slack.id
      };
    }
    return tmpUser;
  }

  /**
   * Returns formatted user object with online status
   * @param {Object} user User object
   */
  userWithOnlineStatus(user) {
    const result = this.user(user);
    result.onlineStatus = user.onlineStatus;
    result.timeZone = user.timeZone;
    return result;
  }

  /**
   * Format raw workspace data in secure way
   * @param {object} workspace Workspace object
   * @param {object} relation Relation object
   * @returns {object} Secure object
   */
  workspaceForUser(workspace, relation) {
    return {
      id: workspace.id,
      name: workspace.name,
      avatar: !isNull(workspace.avatar) ? workspace.avatar: undefined,
      createdAt: workspace.created_at,
      updatedAt: workspace.updated_at,
      user: {
        role: relation.role
      }
    };
  }

  /**
   * Returns secure object info of workspace
   * @param {object} info Workspace object
   */
  workspace(info) {
    return {
      id: info.id,
      name: info.name,
      avatar: !isNull(info.avatar) ? info.avatar : undefined,
      createdAt: info.created_at,
      updatedAt: info.updated_at
    };
  }

  /**
   * Format raw channel data in secure way
   * @param {object} channel Channel object
   * @returns {object} Formatted channel info
   */
  channel(channel) {
    const result = {
      id: channel.id,
      name: channel.name,
      description: !isNull(channel.description) ? channel.description : undefined,
      isPrivate: channel.is_private,
      createdAt: channel.created_at,
      updatedAt: channel.updated_at
    };
    if (isNull(channel.tmp_active_until)) {
      result.isTemporary = false;
    } else {
      result.isTemporary = true;
      result.expiredAt = channel.tmp_active_until;
    }
    return result;
  }

  /**
   * Format raw channel data and add user token
   * @param {object} channel Channel object
   */
  channelForUser(channel) {
    const formatted = this.channel(channel);
    return {
      ...formatted,
      role: channel.role,
      users: channel.users
    };
  }
};
