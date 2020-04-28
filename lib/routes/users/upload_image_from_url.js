'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const errorMessages = require('../../error_messages');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/image-from-url',
  options: {
    tags: ['api', 'user'],
    description: 'Upload an image (jpg, jpeg, png) by a public url',
    validate: {
      payload: Joi.object({
        url: Joi.string().uri().required()
      })
    },
    response: {
      failAction: 'error',
      status: {
        200: Joi.object({
          image: Joi.string().uri().required()
        })
      }
    }
  },
  handler: async (request, h) => {
    const { fileService } = request.services();
    const { url } = request.payload;

    try {
      const imageUrl = await fileService.uploadImageFromUrl(url);
      return {
        image: imageUrl
      };
    } catch(e) {
      if (e.message === 'MediaType is not supported!') {
        return Boom.unsupportedMediaType();
      } else if (e.message === 'File is not found!') {
        return Boom.badRequest(errorMessages.fileNotFound);
      }
      console.log(e);
      request.log(['debug-error'], 'Error on upload user image: ', e);
      return Boom.internal();
    }
  }
});
