'use strict';

const errorMessages = require('../../error_messages');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const Helpers = require('../helpers');

/* Add square brackets because of two methods for that route (see https://github.com/hapipal/discuss/issues/3) */
module.exports = Helpers.withDefaults({
  method: ['GET'],
  path: '/detach-account/{service}',
  options: {
    tags: ['api', 'socialauth'],
    description: 'Detach social account',
    validate: {
      params: Joi.object({
        service: Joi.valid('facebook', 'google', 'slack').required()
      }),
    },
  },
  handler: async (request, h) => {
    const {
      userService,
    } = request.services();

    const { userId } = request.auth.credentials;
    const { service } = request.params;

    try {
      await userService.detachExternalService(userId, service);

      return 'OK';
    } catch (e) {
      if (e.message === 'ServiceNotAttached') {
        return Boom.badRequest(errorMessages.serviceNotAttached);
      } else if (e.message === 'UserNotFound') {
        return Boom.notFound();
      }
      request.log(['debug-error'], 'Error on detach external service: ' + e);
      return Boom.internal();
    }
  }
});
