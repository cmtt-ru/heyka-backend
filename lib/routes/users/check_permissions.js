'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const errorMessages = require('../../error_messages');
const Joi = require('@hapi/joi');
const { capitalize } = require('./../helpers');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/check-permissions',
  options: {
    tags: ['api', 'user'],
    description: 'Check user permissions for any set of actions',
    validate: {
      query: Joi.object({
        // Actions parameter should follow pattern: entity.action,entity2.action2,...
        actions: Joi.string().required()
          .regex(/^[a-z]+\.[a-z]+(,([a-z]+\.[a-z]+)+)*$/i)
          .description('Pattern: "entity.actionInCamelCase,entity.actionInCamelCase,...'),
        channelId: Joi.string().uuid().optional(),
        workspaceId: Joi.string().uuid().optional(),
        userId: Joi.string().uuid().optional(),
        inviteId: Joi.string().uuid().optional()
      })
    }
  },
  handler: async (request, h) => {
    const { 
      permissionService
    } = request.services();
    const { userId } = request.auth.credentials;
    const { actions: actionsString } = request.query;
    const requestErrors = {};

    try {
      const actions = actionsString.split(',').map(act => {
        const [entity, whatToDo] = act.split('.');
        const methodName = `can${capitalize(whatToDo)}${capitalize(entity)}`;
        const method = permissionService[methodName];
        if (!method) {
          requestErrors[act] = 'Unknow action';
          return;
        }
        if (!request.query[`${entity}Id`]) {
          requestErrors[act] = `Query parameter "${entity}Id" is required`;
        }
        return {
          action: act,
          entityId: request.query[`${entity}Id`],
          method: method.bind(permissionService)
        };
      });

      if (Object.keys(requestErrors).length) {
        const error = Boom.badRequest(errorMessages.checkPermissionError);
        error.output.payload.data = requestErrors;
        return error;
      }

      const resultArray = await Promise.all(actions.map(async act => {
        return {
          action: act.action,
          result: await act.method(act.entityId, userId)
        };
      }));

      const result = resultArray.reduce((prev, curr) => ({
        ...prev,
        [curr.action]: curr.result
      }), {});

      return result;
    } catch (e) {
      request.log(['debug-error'], 'Error on checking permissions: ' + e);
      return Boom.internal();
    }
  }
});
