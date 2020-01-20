'use strict';

const Schmervice = require('schmervice');
const uuid4 = require('uuid/v4');

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
   * Whether a user can create channels in a certain workspace
   * @param {uuid} workspaceId Workspace id
   * @param {uuid} userId User id
   * @returns {boolean}
   */
  async canCreateChannel(workspaceId, userId) {
    const { 
      workspaceDatabaseService: wdb
    } = this.server.services();

    const relations = await wdb.getUserWorkspaceRelation(workspaceId, userId);
    if (relations.length === 0) {
      return false;
    } else if (relations.length > 1) {
      this.server.log(['warn'], `Multiple workspace_members relations: userId(${userId}), workspaceId(${workspaceId})`);
    }

    const role = relations[0].role;
    return role === wdb.roles().admin || role === wdb.roles().moderator();
  }
};
