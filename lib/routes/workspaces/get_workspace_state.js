'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const schemas = require('../../schemas');
const errorMessages = require('../../error_messages');

const responseSchema = Joi.object({
  workspace: schemas.workspaceForUser.required(),
  channels: Joi.array().items(schemas.channelForUser).required(),
  users: Joi.array().items(schemas.fullWorkspaceStateUser).required()
}).label('WorkspaceState');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/workspaces/{workspaceId}',
  options: {
    tags: ['api', 'workspaces'],
    description: 'Get full state of a certain workspace',
    validate: {
      params: Joi.object({
        workspaceId: Joi.string().uuid().required()
      })
    },
    response: {
      status: {
        200: responseSchema,
        404: Joi.any().example(Boom.notFound(errorMessages.notFound).output.payload)
          .description('Workspace is not found or you have not access to the workspace')
      },
      failAction: 'error'
    }
  },
  handler: async (request, h) => {
    const {
      workspaceService,
      displayService,
    } = request.services();
    const { workspaceId } = request.params;
    const { userId } = request.auth.credentials;

    try {
      const state = await workspaceService.getWorkspaceStateForUser(workspaceId, userId);

      const response = {
        workspace: displayService.workspaceForUser(state.workspace, state.relation),
        channels: state.channels.map(ch => displayService.channelForUser(ch)),
        users: state.users.map(u => displayService.fullWorkspaceStateUser(u))
      };
      return response;
    } catch (e) {
      if (e.message === 'NotPermitted') {
        return Boom.notFound(errorMessages.notFound);
      }
      request.log(['debug-error'], 'Error on get list of my workspaces' + e + e.stack);
      return Boom.internal();
    }
  }
});
