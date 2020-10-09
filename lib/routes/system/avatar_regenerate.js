'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/reset-avatars',
  options: {
    tags: ['api', 'system'],
    description: 'Regenerate avatar info',
  },
  handler: async (request, h) => {
    const db = request.server.plugins['hapi-pg-promise'].db;
    const {
      fileService,
    } = request.services();

    try {
      const users = await db.any('SELECT id,avatar_file_id FROM users WHERE avatar_file_id IS NOT NULL');
      const workspaces = await db.any('SELECT id,avatar_file_id FROM workspaces WHERE avatar_file_id IS NOT NULL');

      for (let i in users) {
        const imageSet = await fileService.getImageSetForOwnedEntity('avatar', null, users[i].avatar_file_id);
        await db.none('UPDATE users SET avatar_set=$1:json WHERE id=$2', [imageSet, users[i].id]);
      }

      for (let i in workspaces) {
        const imageSet = await fileService.getImageSetForOwnedEntity('avatar', null, workspaces[i].avatar_file_id);
        await db.none('UPDATE workspaces SET avatar_set=$1:json WHERE id=$2', [imageSet, workspaces[i].id]);
      }

      return {
        users: users.length,
        workspaces: workspaces.length,
      };
    } catch (e) {
      request.log(['debug-error'], 'Error on generate new avatar sets: ' + e);
      return Boom.internal();
    }
  }
});
