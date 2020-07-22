'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');
const errorMessages = require('../../error_messages');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/invite-response',
  options: {
    tags: ['api', 'user'],
    description: 'Response for invite',
    validate: {
      payload: Joi.object({
        inviteId: Joi.string().required().uuid(),
        response: Joi.object()
      })
    },
  },
  handler: async (request, h) => {
    const { 
      userService
    } = request.services();
    const {
      inviteId,
      response,
    } = request.payload;
    
    try {
      await userService.responseInvite(inviteId, response);

      return 'ok';
    } catch (e) {
      if (e.message === 'NotFound') {
        return Boom.badRequest(errorMessages.messageNotFound);
      }
      request.log(['debug-error'], 'Error sending response on invite to user: ' + e);
      return Boom.internal();
    }
  }
});
