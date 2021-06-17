'use strict';

const uuid = require('uuid/v4');
const Schmervice = require('schmervice');

module.exports = class GroupService extends Schmervice.Service {

  constructor (...args) {
    super(...args);
  }

  /**
   * Create group
   * 
   * @param {string} workspaceId Workspace id
   * @param {string} userId User id
   * @param {object} data 
   * @param {string} data.name
   * @param {array<string>} data.users
   */
  async createGroup(workspaceId, userId, data) {
    const {
      groupDatabaseService
    } = this.server.services();

    const now = new Date();
    const groupInfo = {
      id: uuid(),
      name: data.name,
      created_at: now,
      updated_at: now,
      creator_id: userId,
      workspace_id: workspaceId,
    };

    await groupDatabaseService.insertGroup(groupInfo);

    // include user in group
    if (data.users && data.users.length > 0) {
      await Promise.all(data.users.map(uId => this.addUserToGroup(groupInfo.id, uId)));
    }

    return groupInfo;
  }

  /**
   * Add user to group
   * @param {string} groupId Group id
   * @param {string} userId User id
   */
  async addUserToGroup(groupId, userId) {
    const {
      workspaceDatabaseService,
      groupDatabaseService,
    } = this.server.services();

    const group = await groupDatabaseService.getGroupById(groupId);

    if (!group) {
      throw new Error('Group not found');
    }

    // check that user in the workspace
    const userWorkspaceRelations = await workspaceDatabaseService.getUserWorkspaceRelations(group.workspace_id, userId);

    if (userWorkspaceRelations.length === 0) {
      throw new Error('User not in workspace');
    }

    const userGroupRelation = await groupDatabaseService.getUserGroupRelation(groupId, userId);

    if (userGroupRelation) {
      return;
    }

    const now = new Date();
    const relationInfo = {
      group_id: groupId,
      workspace_id: group.workspace_id,
      user_id: userId,
      updated_at: now,
      created_at: now,
    };

    await groupDatabaseService.insertGroupsMembersRelation(relationInfo);
  }

  /**
   * Delete user from group
   * @param {string} groupId Group id
   * @param {string} userId User id
   */
  async deleteMemberFromGroup(groupId, userId) {
    const {
      groupDatabaseService
    } = this.server.services();

    await groupDatabaseService.deleteMemberGroupRelation(groupId, userId);
  }
};
