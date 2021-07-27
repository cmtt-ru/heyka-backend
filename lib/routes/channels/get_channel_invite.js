'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');
const schemas = require('../../schemas');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/channels/{channelId}/invite',
  options: {
    tags: ['api', 'channels'],
    description: 'Get invite-JWT for non-member user',
    validate: {
      params: Joi.object({
        channelId: Joi.string().required().uuid(),
      }),
    },
    response: {
      failAction: 'log',
      status: {
        200: schemas.channelInvite,
      },
    },
  },
  handler: async (request, h) => {
    const {
      displayService,
      inviteCodesDatabaseService: inviteCodes,
    } = request.services();
    const { channelId } = request.params;
    
    try {
      const channelInvites = await inviteCodes.getActualInvitesByChannel(channelId, 'channelInvite');

      if (channelInvites.length === 0) {
        return Boom.notFound('InviteNotFound');
      }

      return displayService.channelInvite(channelInvites[0]);
    } catch (e) {
      request.log(['debug-error'], 'Error on getting an actual invite for channel: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
