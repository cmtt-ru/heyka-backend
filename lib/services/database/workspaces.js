'use strict';

const Schmervice = require('schmervice');
const pgPromise = require('pg-promise')();

const WorkspaceColumnSet = new pgPromise.helpers.ColumnSet([
  'id',
  'name',
  {
    name: 'avatar', def: null
  },
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

module.exports = class WorkspaceDatabaseService extends Schmervice.Service {

  constructor (...args) {
    super(...args);
  }
  
  /**
   * Returns a list with workspaces roles
   */
  roles () {
    return {
      admin: 'admin',
      moderator: 'moderator',
      user: 'user',
      guest: 'guest'
    };
  }

  /**
   * Returns all workspaces that the user belongs to
   * @param {uuid} userId User guid
   */
  async getWorkpsacesByUserId(userId) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const q = `
      SELECT w.* FROM workspaces w 
      INNER JOIN workspaces_members wm ON wm.workspace_id = w.id
      WHERE wm.user_id = $1
    `;
    return await db.any(q, userId);
  }

  /**
   * Insert workspace to the database
   * @param {object} info Workspace info
   */
  async insertWorkspace (info) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const query = pgPromise.helpers.insert(info, WorkspaceColumnSet);
    await db.none(query);
  }

  /**
   * Add record to the table with workspace-member relation
   * @param {object} relation Relation info
   */
  async addWorkspaceMember (relation) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const query = pgPromise.helpers.insert(relation, WorkspacesMembersColumnSet);
    await db.none(query);
  }

  /**
   * Updates workspace in the database and return result object
   * @param {string} id Workspace id
   * @param {object} update Update info
   */
  async updateWorkspace (id, update) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const updateWorkspaceQuery = pgPromise.helpers.update(update, null, 'workspaces') 
      + pgPromise.as.format(' WHERE id=$1', id);
    return await db.query(updateWorkspaceQuery + ' RETURNING *');
  }
};