'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const jwt = require('jsonwebtoken');

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
    const {
      userService,
      userDatabaseService: udb,
    } = request.services();
    
    try {
      const unverifiedData = jwt.decode(token);
      const user = await udb.findById(unverifiedData.userId);

      if (!user) {
        return Boom.notFound();
      }

      const secret = user.password_hash || config.jwtSecret;

      const isValid = await userService.validateJWT(token, secret);

      return {
        result: isValid
      };
    } catch (e) {
      request.log(['debug-error'], 'Error on sign up user: ' + e);
      return Boom.internal();
    }
  }
});
