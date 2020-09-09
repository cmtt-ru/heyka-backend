'use strict';

const Schmervice = require('schmervice');

module.exports = class InviteService extends Schmervice.Service {
  constructor(...args) {
    super(...args);
  }

  /**
   * Delete invite and revoke access for all users who signed up from this invite (if it's needed)
   * @param {string} inviteId Invite id
   * @param {boolean} revokeAccess Should access be revoked for all users by this invite
   */
  async deleteInvite(inviteId, revokeAccess = false) {
    const {
      inviteCodesDatabaseService: invdb,
      workspaceService,
    } = this.server.services();

    const invite = await invdb.getInviteById(inviteId);

    if (!invite) {
      throw new Error('InviteNotFound');
    }

    if (revokeAccess) {
      await workspaceService.kickUsersFromWorkspaceByInvite(invite);
    }

    await invdb.deleteInviteCode(inviteId);
  }
};
