'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const schemas = require('../../schemas');
const errorMessages = require('../../error_messages');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/signup',
  options: {
    auth: false,
    tags: ['api', 'auth'],
    description: 'Sign up user with email and password',
    validate: {
      payload: Joi.object({
        user: Joi.object({
          name: Joi.string().max(100).required(),
          lang: Joi.string().optional(),
          email: Joi.string().email().required(),
          password: Joi.string().min(4).required(),
          inviteCode: Joi.string().optional(),
        }).label('SignupUserInfo')
      })
    },
    response: {
      failAction: 'error',
      status: {
        200: schemas.authedUser,
        400: Joi.any().example(Boom.badRequest(errorMessages.emailExists).output.payload)
      }
    }
  },
  handler: async (request, h) => {


    const { user: userInfo } = request.payload;
    const {
      userService,
      displayService,
      workspaceService,
      inviteCodesDatabaseService: invdb,
    } = request.services();
    
    try {
      let codeInfo = {};

      if (userInfo.inviteCode) {
        codeInfo = await workspaceService.getInviteInfo(userInfo.inviteCode);
        if (codeInfo.status !== 'valid') {
          return Boom.badRequest('Invite code is invalid');
        }
      }

      // register user
      const emailVerified = codeInfo.status === 'valid' && codeInfo.email === userInfo.email;
      const user = await userService.signup(userInfo, emailVerified);
      const tokens = await userService.createTokens(user);

      // add user to workspace if invite code is valid, disable invite code
      if (codeInfo.status === 'valid') {
        await workspaceService.addUserToWorkspace(codeInfo.workspace.id, user.id);
        await invdb.updateInvite(codeInfo.id, { disabled: true });
      }

      return {
        user: displayService.userWithConfidentialData(user),
        credentials: tokens
      };
    } catch (e) {
      if (e.message === 'EmailExists') {
        return Boom.badRequest(errorMessages.emailExists);
      }
      request.log(['debug-error'], 'Error on sign up user: ' + e);
      return Boom.internal();
    }
  }
});
