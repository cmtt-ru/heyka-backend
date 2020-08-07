'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/check-token',
  options: {
    auth: false,
    tags: ['api', 'auth'],
    description: 'Validate any tokens',
    validate: {
      query: Joi.object({
        token: Joi.string().required()
      })
    },
  },
  handler: async (request, h) => {
    const { token } = request.query;
    const { userService } = request.services();
    
    try {
      const isValid = userService.validateJWT(token);

      return {
        result: isValid
      };
    } catch (e) {
      request.log(['debug-error'], 'Error on sign up user: ' + e);
      return Boom.internal();
    }
  }
});
