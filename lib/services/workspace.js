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
      workspaceDatabaseService: wdb
    } = this.server.services();
    const now = new Date();
    const workspaceInfo = {
      id: uuid4(),
      name,
      limits: {},
      janus: {},
      created_at: now,
      updated_at: now
    };
    const workspaceMemberInfo = {
      user_id: user.id,
      workspace_id: workspaceInfo.id,
      role: 'admin'
    };
    await wdb.insertWorkspace(workspaceInfo);
    await wdb.addWorkspaceMember(workspaceMemberInfo);
    const janusInfo = await janusWorkspaceService.createServer();
    return await wdb.updateWorkspace(workspaceInfo.id, { janus: janusInfo });
  }
};
