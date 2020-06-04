'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');
const errorMessages = require('../../error_messages');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/message-response',
  options: {
    tags: ['api', 'user'],
    description: 'Response for message',
    validate: {
      payload: Joi.object({
        messageId: Joi.string().required().uuid(),
        response: Joi.object()
      })
    },
  },
  handler: async (request, h) => {
    const { 
      userService
    } = request.services();
    const {
      messageId,
      response,
    } = request.payload;
    
    try {
      await userService.responseMessage(messageId, response);

      return 'ok';
    } catch (e) {
      if (e.message === 'NotFound') {
        return Boom.badRequest(errorMessages.messageNotFound);
      }
      request.log(['debug-error'], 'Error sending message to user: ' + e);
      return Boom.internal();
    }
  }
});
