'use strict';

const Schmervice = require('schmervice');
const pgPromise = require('pg-promise')();

const GroupColumnSet = new pgPromise.helpers.ColumnSet([
  'id',
  'name',
  'created_at',
  'updated_at',
  'workspace_id',
  'creator_id'
], { table: 'groups' });

const GroupsMembersColumnSet = new pgPromise.helpers.ColumnSet([
  'workspace_id',
  'user_id',
  'group_id',
], { table: 'groups_members'});

module.exports = class GroupDatabaseService extends Schmervice.Service {

  constructor (...args) {
    super(...args);
  }


  /**
   * Get group list
   * Returns {array<group>}
   */
  async getGroupList (){
    const db = this.server.plugins['hapi-pg-promise'].db;

    return db.query('SELECT * FROM groups');
  }

  /**
   * Find group by id
   * @param {string} groupId 
   */
  async getGroupById(groupId) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    return db.oneOrNone('SELECT * FROM groups WHERE id=$1', [groupId]);
  }

  /**
   * Returns count of groups
   */
  async getGroupsCount() {
    const db = this.server.plugins['hapi-pg-promise'].db;

    const result = await db.query('SELECT COUNT(DISTINCT id)  FROM groups');

    const {count} = result[0];

    return +count;
  }

  /**
   * Find user group relation
   * @param {string} groupId
   * @param {string} userId
   */
  async getUserGroupRelation(groupId, userId) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    return db.oneOrNone('SELECT * FROM groups_members WHERE user_id=$1 AND group_id=$2', [userId, groupId]);
  }

  /**
   * Find all group members
   * @param {string} groupId
   */
  async getAllGroupMembers(groupId) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    return db.any('SELECT * FROM groups_members WHERE group_id=$2', [groupId]);
  }

  /**
   * Get all groups of workspace
   * @param {string} workspaceId
   */
  async getGroupsByWorkspaceId(workspaceId) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const q = `
      SELECT
        gr.*,COUNT(gm.*) as members_count
      FROM groups gr 
      LEFT OUTER JOIN groups_members gm ON gm.group_id = gr.id
      WHERE gr.workspace_id = $1
      GROUP BY gr.id
    `;
    return db.any(q, [workspaceId]);
  }

  /**
   * Get all groups members with latest activity
   * @param {string} groupId
   */
  async getGroupMembers(groupId) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const q = `
      SELECT u.*,MAX(s.refreshed_at) as latest_activity_at FROM users u 
      INNER JOIN groups_members gm ON gm.user_id = u.id
      LEFT JOIN sessions s ON s.user_id = u.id
      WHERE gm.group_id = $1
      GROUP BY u.id
    `;
    return await db.any(q, [groupId]);
  }

  /**
   * Insert group to the database
   * @param {object} info Group info
   */
  async insertGroup(info) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const query = pgPromise.helpers.insert(info, GroupColumnSet);
    await db.none(query);
  }

  /**
   * Update group
   * @param {string} groupId
   * @param {object} info Group info
   */
  async updateGroup(groupId, info) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const updateGroupQuery = pgPromise.helpers.update(info, null, 'groups') 
      + pgPromise.as.format(' WHERE id=$1', groupId);
    return await db.none(updateGroupQuery);
  }

  /**
   * Delete group
   * @param {string} groupId
   */
  async deleteGroup(groupId) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    return await db.none('DELETE FROM groups WHERE id=$1', [groupId]);
  }

  /**
   * Insert groups members relation
   * @param {object} info Relation info
   */
  async insertGroupsMembersRelation(info) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const q = pgPromise.helpers.insert(info, GroupsMembersColumnSet);
    await db.none(q);
  }

  /**
   * Delete relation between user and group
   * @param {string} groupId
   * @param {string} userId
   */
  async deleteMemberGroupRelation(groupId, userId) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    return db.oneOrNone('DELETE FROM groups_members WHERE user_id=$1 AND group_id=$2', [userId, groupId]);
  }
};
