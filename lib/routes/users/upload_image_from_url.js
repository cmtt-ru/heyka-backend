'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const errorMessages = require('../../error_messages');
const schemas = require('../../schemas');

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
      failAction: 'log',
      status: {
        200: Joi.object({
          image: Joi.string().uri().required()
        }),
        400: schemas.boomError.description(`
          message = "${errorMessages.mediaTypeNotSupported}"
            You provided an avatar url, but media type of given image is not supported (only png, jpg and webp)
          message = "${errorMessages.downloadImageError}"
            Cannot download avatar image from given url, check it
        `),
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
        return Boom.badRequest(errorMessages.mediaTypeNotSupported);
      } else if(e.message === 'Download error') {
        return Boom.badRequest(errorMessages.downloadImageError);
      }
      console.log(e);
      request.log(['debug-error'], 'Error on upload user image: ', e);
      return Boom.internal();
    }
  }
});
