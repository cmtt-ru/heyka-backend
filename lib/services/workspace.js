'use strict';

const Schmervice = require('schmervice');
const pgPromise = require('pg-promise')();
const uuid4 = require('uuid/v4');

const WorkspaceColumnSet = new pgPromise.helpers.ColumnSet([
  'id',
  'name',
  { name: 'avatar', def: null },
  'created_at',
  'updated_at',
  {
    name: 'limits',
    def: '{}'
  },
  {
    name: 'janus',
    def: '{}'
  }
], { table: 'workspaces' });

const WorkspacesMembersColumnSet = new pgPromise.helpers.ColumnSet([
  'workspace_id',
  'user_id',
  'role'
], { table: 'workspaces_members'});

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
    const { janusWorkspaceService } = this.server.services();
    const db = this.server.plugins['hapi-pg-promise'].db;
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
    const workspaceQuery = pgPromise.helpers.insert(workspaceInfo, WorkspaceColumnSet);
    const workspaceMemberQuery = pgPromise.helpers.insert(workspaceMemberInfo, WorkspacesMembersColumnSet);
    await db.query(workspaceQuery);
    await db.query(workspaceMemberQuery);
    const janusInfo = await janusWorkspaceService.createServer();
    const updateWorkspaceQuery = pgPromise.helpers.update({ janus: janusInfo }, null, 'workspaces') 
      + pgPromise.as.format(' WHERE id=$1', workspaceInfo.id);
    return await db.query(updateWorkspaceQuery + ' RETURNING *');
  }
};
