'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');
const errorMessages = require('../../error_messages');

module.exports = Helpers.withDefaults({
  method: 'DELETE',
  path: '/invites/{inviteId}',
  options: {
    tags: ['api', 'invite'],
    description: 'Delete the invite',
    validate: {
      query: Joi.object({
        revokeAccess: Joi.boolean().default(false),
      }),
    },
    response: {
      status: {
        200: Joi.valid('ok'),
        404: Joi.any().example(Boom.forbidden(errorMessages.notFound).output.payload)
          .description('Invite not found'),
        403: Joi.any().example(Boom.forbidden(errorMessages.accessDenied).output.payload)
          .description('User hasn\'t access to the invite')
      },
      failAction: 'error',
    }
  },
  handler: async (request, h) => {
    const {
      inviteService,
      permissionService
    } = request.services();
    const { userId } = request.auth.credentials;
    const { inviteId } = request.params;
    const {
      revokeAccess
    } = request.query;
    
    try {
      const canUpdateChannel = await permissionService.canDeleteInvite(inviteId, userId);
      if (!canUpdateChannel) {
        return Boom.forbidden(errorMessages.accessDenied);
      }

      await inviteService.deleteInvite(inviteId, revokeAccess);

      return 'ok';
    } catch (e) {
      if (e.message === 'InviteNotFound') {
        return Boom.notFound(errorMessages.notFound);
      }
      request.log(['debug-error'], 'Error on delete invite: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
