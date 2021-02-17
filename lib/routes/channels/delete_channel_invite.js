'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');

module.exports = Helpers.withDefaults({
  method: 'DELETE',
  path: '/channel-invites/{inviteId}',
  options: {
    tags: ['api', 'channels'],
    description: 'Delete invite token',
    validate: {
      params: Joi.object({
        inviteId: Joi.string().required().uuid(),
      }),
    },
  },
  handler: async (request, h) => {
    const {
      inviteCodesDatabaseService: inviteCodes,
    } = request.services();
    const { inviteId } = request.params;
    
    try {
      await inviteCodes.deleteInviteCode(inviteId);
      return 'ok';
    } catch (e) {
      request.log(['debug-error'], 'Error on deleting invite: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
