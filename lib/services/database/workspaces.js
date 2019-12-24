'use strict';

const Schmervice = require('schmervice');
const pgPromise = require('pg-promise')();

const WorkspaceColumnSet = new pgPromise.helpers.ColumnSet([
  'id',
  'name',
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
