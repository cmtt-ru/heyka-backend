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
    const object = {
      id: user.id,
      name: user.name,
      lang: !isNull(user.lang) ? user.lang : undefined,
      avatarSet: !isNull(user.avatar_set) ? user.avatar_set : undefined,
      avatarFileId: !isNull(user.avatar_file_id) ? user.avatar_file_id : undefined,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      isEmailVerified: !isNull(user.is_email_verified) ? user.is_email_verified : undefined,
    };
    if (user.email) {
      object.email = user.email;
    }
    return object;
  }

  /**
   * Return user info with workspace/channel relations
   * @param {object} userWithRelations 
   */
  channelMemberInfo (userWithRelations) {
    const o = this.user(userWithRelations);
    o.workspaceRelation = {
      role: userWithRelations.workspace_role,
    };
    o.channelRelation = {
      role: userWithRelations.channel_role,
    };
    return o;
  }

  /**
   * Format raw user data in secure way and add confidential data to id
   * @param {object} userData User object
   * @returns {object} Secure object with confidential data
   */
  userWithConfidentialData(userData) {
    const tmpUser = this.user(userData);
    
    // add social auth data
    tmpUser.socialAuth = {};
    if (userData.auth) {
      if (userData.auth.facebook) {
        tmpUser.socialAuth.facebook = {
          id: userData.auth.facebook.id
        };
      }
      if (userData.auth.google) {
        tmpUser.socialAuth.google = {
          id: userData.auth.google.id
        };
      }
      if (userData.auth.slack) {
        tmpUser.socialAuth.slack = {
          id: userData.auth.slack.id
        };
      }
    }

    // add app_settings
    tmpUser.appSettings = userData.app_settings || {};

    return tmpUser;
  }

  /**
   * Returns formatted user object with online status
   * @param {Object} user User object
   */
  fullWorkspaceStateUser(user) {
    const result = this.user(user);
    result.onlineStatus = user.online_status || 'offline';
    result.timeZone = user.timeZone;
    result.role = user.role;
    result.callsCount = user.calls_count || 0;
    if (user.latest_call) {
      result.latestCall = user.latest_call;
    }
    return result;
  }

  /**
   * Returns formatted user object for admin purposes
   * @param {Object} user User object
   */
  workspaceMemberForAdmin(user) {
    const result = this.user(user);
    result.role = user.role;
    result.latestActivityAt = user.latest_activity_at || null;
    return result;
  }

  /**
   * Format raw workspace data in secure way
   * @param {object} workspace Workspace object
   * @param {object} relation Relation object
   * @returns {object} Secure object
   */
  workspaceForUser(workspace, relation) {
    const result = this.workspace(workspace);
    result.userRelation = {
      role: relation.role,
    };
    return result;
  }

  /**
   * Format raw workspace data in settings object
   * @param {object} workspace Workspace object
   * @returns {object} Secure object
   */
  workspaceSettings(workspace) {
    const result = this.workspace(workspace);
    result.canUsersInvite = !!workspace.can_users_invite;
    return result;
  }

  /**
   * Returns secure object info of workspace
   * @param {object} info Workspace object
   */
  workspace(info) {
    const result = {
      id: info.id,
      name: info.name,
      avatar: !isNull(info.avatar) ? info.avatar : undefined,
      createdAt: info.created_at,
      updatedAt: info.updated_at
    };
    if (info.avatar_file_id) {
      result.avatarFileId = info.avatar_file_id;
      result.avatarSet = info.avatar_set;
    }
    if (info.slack && info.slack.access_token) {
      result.slack = {
        id: info.slack.team.id,
        name: info.slack.team.name,
      };
    }
    return result;
  }

  /**
   * Returns secure object info of invites
   * @param {object} info Raw invite object
   */
  invite(info) {
    const result = {
      id: info.id,
      workspaceId: info.workspace_id,
      channelId: !isNull(info.channel_id) ? info.channel_id : undefined,
      createdBy: info.created_by,
      createdAt: info.created_at,
      updatedAt: info.updated_at,
      expiredAt: info.expired_at,
      code: info.code,
    };
    return result;
  }

  /**
   * Format channel invite
   * @param {object} info Channel invite info
   */
  channelInvite(info) {
    const result = {
      id: info.id,
      token: info.code,
      expiredAt: info.expired_at,
      channelId: info.channel_id,
      workspaceId: info.workspace_id,
    };
    return result;
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
      creatorId: channel.creator_id,
      isPrivate: channel.is_private,
      createdAt: channel.created_at,
      updatedAt: channel.updated_at
    };
    if (channel.is_tmp) {
      if (!isNull(channel.tmp_active_until)) {
        result.expiredAt = channel.tmp_active_until;
      }
      result.isTemporary = true;
    } else {
      result.isTemporary = false;
    }
    return result;
  }

  /**
   * Format raw channel data and add user token
   * @param {object} channel Channel object
   */
  channelForUser(channel) {
    const formatted = this.channel(channel);
    const result = {
      ...formatted,
      userRelation: {
        role: channel.role,
        usageCount: channel.usage_count || 0,
      },
      users: channel.users,
    };
    if (channel.latest_usage) {
      result.userRelation.latestUsage = channel.latest_usage;
    }
    return result;
  }
};
