'use strict';

const Schmervice = require('schmervice');

/**
 * Permission methods should be names according the pattern:
 *  can{ActionName}{EntityName}(entityId<String>, userId<String>, additionalInfo<Object>)
 * 
 * For example:
 *  canUpdateChannel(channelId, userId)
 *  canInviteWorkspace(workspaceId, userId, { role: 'admin' })
 */

module.exports = class PermissionService extends Schmervice.Service {

  /**
   * 
   * User permissions
   * 
   */

  /**
   * Can any user view another user info
   * 
   * @param {string} targetUserId Target user id
   * @param {string} userId User id
   */
  async canViewUserInfo(targetUserId, userId) {
    const {
      workspaceDatabaseService: wdb,
    } = this.server.services();

    const [
      userWorkspaces,
      targetUserWorkspaces,
    ] = await Promise.all([
      wdb.getWorkspacesByUserId(userId),
      wdb.getWorkspacesByUserId(targetUserId),
    ]);

    if (userWorkspaces.length === 0 || targetUserWorkspaces.length === 0) {
      return false;
    }

    for (let i in userWorkspaces) {
      if (targetUserWorkspaces.find(w => w.id === userWorkspaces[i].id)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 
   * Channel permissions
   * 
   */

  async canInviteChannel(channelId, userId) {
    const {
      channelDatabaseService: chdb,
      workspaceDatabaseService: wdb,
    } = this.server.services();

    const channelRelation = await chdb.getChannelMemberRelation(channelId, userId);
    const [ workspaceRelation ] = await wdb.getUserWorkspaceRelations(channelRelation.workspace_id, userId);
    if (!channelRelation || !workspaceRelation) return false;
    return ['admin', 'moderator', 'user'].includes(channelRelation.role)
      && ['admin', 'moderator', 'user'].includes(workspaceRelation.role);
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
   * Can user view channel info
   * @param {string} channelId 
   * @param {string} userId 
   */
  async canViewChannelInfo(channelId, userId) {
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
   * Can user add/delete members in channels
   * @param {string} channelId 
   * @param {string} userId 
   */
  async canManageChannelMembers(channelId, userId) {
    const {
      channelDatabaseService: chdb
    } = this.server.services();

    const relation = await chdb.getChannelMemberRelation(channelId, userId);

    if (!relation) return false;
    const roles = chdb.roles();
    return relation.role === roles.admin;
  }

  /**
   * Can user update or delete the channel
   * @param {string} channelId Channel id
   * @param {string} userId User id
   * @returns {boolean}
   */
  async canUpdateOrDeleteChannel(channelId, userId) {
    const {
      channelDatabaseService: chdb,
      workspaceDatabaseService: wdb
    } = this.server.services();
    const channel = await chdb.getChannelById(channelId);
    
    if (channel.creator_id === userId) {
      return true;
    }

    const [ usrWsRelation ] = await wdb.getUserWorkspaceRelations(channel.workspace_id, userId);

    return usrWsRelation.role === wdb.roles().admin || usrWsRelation.role === wdb.roles().moderator;
  }

  /**
   * Can user update channel
   * @param {string} channelId Channel id
   * @param {string} userId User id
   * @returns {boolean}
   */
  canUpdateChannel(channelId, userId) {
    return this.canUpdateOrDeleteChannel(channelId, userId);
  }

  /**
   * Can user delete channel
   * @param {string} channelId Channel id
   * @param {string} userId User id
   * @returns {boolean}
   */
  canDeleteChannel(channelId, userId) {
    return this.canUpdateOrDeleteChannel(channelId, userId);
  }

  /**
   * Can user delete all invites to the channel
   * @param {string} channelId Channel id
   * @param {string} userId User id
   */
  async canDeleteAllInvitesChannel(channelId, userId) {
    const {
      channelDatabaseService: chdb,
      workspaceDatabaseService: wdb
    } = this.server.services();
    const channel = await chdb.getChannelById(channelId);
    
    if (channel.creator_id === userId) {
      return true;
    }

    const [ usrWsRelation ] = await wdb.getUserWorkspaceRelations(channel.workspace_id, userId);

    return usrWsRelation.role !== wdb.roles().guest;
  }

  /**
   * 
   * Workspace permissions
   * 
   */

  /**
   * Can user access to workspace info
   * @param {string} workspaceId Workspace id
   * @param {string} userId User id
   */
  async canViewWorkspaceInfo(workspaceId, userId) {
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
   * Can user update workspace
   * @param {string} workspaceId Workspace id
   * @param {string} userId User id
   */
  async canUpdateWorkspace(workspaceId, userId) {
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
    return role === wdb.roles().admin || role === wdb.roles().moderator;
  }
  
  async canRevokeAccessWorkspace(workspaceId, userId, kickedUserId) {
    const { 
      workspaceDatabaseService: wdb,
    } = this.server.services();

    const relations = await wdb.getUserWorkspaceRelations(workspaceId, userId);
    if (relations.length === 0) {
      return false;
    } else if (relations.length > 1) {
      this.server.log(['warn'], `Multiple workspace_members relations: userId(${userId}), workspaceId(${workspaceId})`);
    }

    const role = relations[0].role;

    if (role !== 'admin') {
      return false;
    }

    const workspace = await wdb.getWorkspaceById(workspaceId);

    if (workspace.creator_id === kickedUserId) {
      return false;
    }

    return true;
  }

  /**
   * Whether a user can create channels in a certain workspace
   * @param {uuid} workspaceId Workspace id
   * @param {uuid} userId User id
   * @returns {boolean}
   */
  async canCreateChannelWorkspace(workspaceId, userId) {
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
  async canInviteWorkspace(workspaceId, userId) {
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
  async canSubscribeEventsWorkspace(workspaceId, userId) {
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
  async canConnectSlackWorkspace(workspaceId, userId) {
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
   * Can user get all slack users
   * Returns true/false
   * @param {string} workspaceId
   * @param {string} userId 
   */
  async canGetSlackUsersWorkspace(workspaceId, userId) {
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
    return role !== wdb.roles().guest;
  }

  /**
   * Can user get list of his own invites in this workspace
   * @param {string} workspaceId Workspace id
   * @param {string} userId User id
   */
  async canGetMyInvitesWorkspace(workspaceId, userId) {
    const { 
      workspaceDatabaseService: wdb
    } = this.server.services();

    const relations = await wdb.getUserWorkspaceRelations(workspaceId, userId);
    return !!relations[0];
  }

  /**
   * Can user get list of all workspace invites
   * Returns true/false
   * @param {string} workspaceId
   * @param {string} userId 
   */
  async canGetAllInvitesWorkspace(workspaceId, userId) {
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
    return role === wdb.roles().admin || role === wdb.roles().moderator;
  }

  /**
   * 
   * Manage permissions
   * 
   */
  
  /**
   * Can user managed any workspaces
   * @param {string} userId User id
   */
  async canManageWorkspaces(_, userId) {
    const {
      workspaceDatabaseService: wdb,
    } = this.server.services();

    const workspaces = await wdb.getWorkspacesByUserId(userId);

    const managedWorkspaces = workspaces
      .filter(w => w.role === 'admin');

    return managedWorkspaces.length > 0;
  }

  /**
   * Can user show users statistic for that workspace
   * @param {string} workspaceId Workspace id
   * @param {string} userId User id
   */
  async canViewUsersStatisticWorkspace(workspaceId, userId) {
    const {
      workspaceDatabaseService: wdb,
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
   * 
   * Invites
   * 
   */
  async canDeleteInvite(inviteId, userId) {
    const {
      workspaceDatabaseService: wdb,
      inviteCodesDatabaseService: invdb,
    } = this.server.services();
    const invite = await invdb.getInviteById(inviteId);
    
    if (invite.created_by === userId) {
      return true;
    }

    const [ usrWsRelation ] = await wdb.getUserWorkspaceRelations(invite.workspace_id, userId);

    return usrWsRelation.role === wdb.roles().admin || usrWsRelation.role === wdb.roles().moderator; 
  }
};
