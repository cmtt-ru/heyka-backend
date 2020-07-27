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
  },
  {
    name: 'slack',
    def: '{}'
  }
], { table: 'workspaces' });

const WorkspacesMembersColumnSet = new pgPromise.helpers.ColumnSet([
  'workspace_id',
  'user_id',
  'role',
  { name: 'janus_auth_token', def: null },
  { name: 'token_granted_at', def: null },
  'created_at',
  'updated_at'
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
   * Returns a workspace by id
   * @param {uuid} workspaceId Workspace id
   */
  async getWorkspaceById (workspaceId) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    return await db.oneOrNone('SELECT * FROM workspaces WHERE id=$1', [workspaceId]);
  }

  /**
   * Returns all workspaces that the user belongs to
   * @param {uuid} userId User guid
   */
  async getWorkspacesByUserId(userId) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const q = `
      SELECT w.* FROM workspaces w 
      INNER JOIN workspaces_members wm ON wm.workspace_id = w.id
      WHERE wm.user_id = $1
    `;
    return await db.any(q, [userId]);
  }

  /**
   * Returns workspace record with user relation
   * @param {string} workspaceId Workspace id
   * @param {string} userId user id
   */
  async getWorkspaceWithRelation(workspaceId, userId) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const q = `
      SELECT w.*, wm.* FROM workspaces w
      INNER JOIN workspaces_members wm ON wm.workspace_id = w.id
      WHERE wm.user_id = $1 AND w.id = $2
    `;
    return await db.oneOrNone(q, [userId, workspaceId]);
  }

  /**
   * Returns an array of admin of the workspace expect the specified user
   * @param {string} workspaceId Workspace id
   * @param {string} userId User id
   */
  async getAdminsExceptUserId(workspaceId, userId) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const q = `
      SELECT u.* FROM users u 
      INNER JOIN workspaces_members wm ON wm.user_id = u.id
      WHERE 
        wm.workspace_id = $1
        AND wm.role = $2
        AND wm.user_id != $3
    `;
    return await db.any(q, [workspaceId, this.roles().admin, userId]);
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
   * Deletes relation between user and workspace
   * @param {string} workspaceId Workspace id
   * @param {string} userId User id
   */
  async deleteWorkspaceMember(workspaceId, userId) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const query = `
      DELETE FROM workspaces_members
      WHERE workspace_id=$1 AND user_id=$2
    `;
    await db.none(query, [workspaceId, userId]);
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
    return (await db.query(updateWorkspaceQuery + ' RETURNING *'))[0];
  }

  /**
   * Get user-workspace relations
   * @param {string} workspaceId Workspace id
   * @param {string} userId User id
   * @returns {array} An array of relations 
   */
  async getUserWorkspaceRelations(workspaceId, userId) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const q = `
      SELECT * FROM workspaces_members wm
      WHERE wm.workspace_id = $1 AND wm.user_id=$2
    `;
    return await db.any(q, [workspaceId, userId]);
  }

  /**
   * Get all members of a certain workspace
   * @param {string} workspaceId Workspace id
   * @returns {array} Array of users
   */
  async getWorkspaceMembers(workspaceId) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const q = `
      SELECT u.*,wm.role FROM users u 
      INNER JOIN workspaces_members wm ON wm.user_id = u.id
      WHERE wm.workspace_id = $1
    `;
    return await db.any(q, [workspaceId]);
  }

  /**
   * Get list of members ids for specific workspace
   * @param {string} workspaceId Workpsace id
   * @returns {Array<string>} List of ids
   */
  async getWorkspaceMemberIds(workspaceId) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const q = `
      SELECT user_id FROM workspaces_members wm
      WHERE wm.workspace_id = $1
    `;
    const list = await db.any(q, [workspaceId]);
    return list.map(o => o.user_id);
  }

  /**
   * Get all channels of a certain workspace
   * @param {string} workspaceId Workspace id
   * @returns {array} Array of channels
   */
  async getWorkspaceChannels(workspaceId) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const q = 'SELECT * FROM channels WHERE workspace_id=$1';
    return await db.any(q, [workspaceId]);
  }

  /**
   * Returns all channels that belong to the user and the workspace
   * @param {string} workspaceId Workspace id
   * @param {string} userId User id
   */
  async getWorkspaceChannelsForUser(workspaceId, userId) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const q = `SELECT ch.*,chm.janus_auth_token,chm.role FROM channels ch 
      INNER JOIN channels_members chm ON chm.channel_id = ch.id
      WHERE chm.workspace_id=$1 AND chm.user_id=$2`;
    return await db.any(q, [workspaceId, userId]);
  }
};
