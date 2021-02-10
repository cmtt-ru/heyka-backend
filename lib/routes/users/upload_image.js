'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const Busboy = require('busboy');
const errorMessages = require('../../error_messages');
const allowedMimeType = require('../../schemas').allowedAvatarMimeTypes;
const ONE_DAY_MILLISECONDS = 1000 * 60 * 60 * 24;
const uuid = require('uuid/v4');
const config = require('../../../config');
const allowedMimeTypes = [
  'image/png',
  'image/jpg',
  'image/jpeg',
];

/**
 * Process raw http request
 * @param {object} req Raw HTTP-request object
 * @returns {Promise<Object>} { fileStream, mimeType } 
 */
function processRawRequest(req) {
  return new Promise((resolve, reject) => {
    const busboy = new Busboy({ headers: req.headers });
    let fileIsFound = false;

    // this handler will be called when busboy found a new file in request
    busboy.on('file', async (fieldname, file, filename, encoding, mimetype) => {
      // we're interested only in file called "image"
      if (fieldname === 'image') {
        // reject an error if mimetype is not supported
        if (!allowedMimeType.includes(mimetype)) {
          return reject(new Error(`MediaType is not supported!`));
        }
        fileIsFound = true;

        // resolve filestream and mimetype
        resolve({
          fileStream: file,
          mimeType: mimetype
        });
      }
    });
    busboy.on('finish', () => {
      if (!fileIsFound) {
        reject(new Error(`File is not found!`));
      }
    });

    // pipe http request to busboy
    req.pipe(busboy);

    // handle busboy errors
    busboy.on('error', e => {
      reject(e);
    });
  });
}

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/image',
  options: {
    tags: ['api', 'user'],
    description: 'Upload an image (jpg, jpeg, png) (Accept multipart uploading, file field name must be "image")',
    payload: {
      output: 'stream',
      parse: false,
      allow: 'multipart/form-data'
    },
    response: {
      failAction: 'error',
      status: {
        200: Joi.object({
          fileId: Joi.string().uuid().required(),
          image32x32: Joi.string().uri().required(),
          image64x64: Joi.string().uri().required(),
          image128x128: Joi.string().uri().required(),
          image256x256: Joi.string().uri().required(),
          image512x512: Joi.string().uri().required(),
        }),
        400: Joi.any().example(Boom.badRequest(errorMessages.fileNotFound).output.payload)
          .description('File "image" is not found'),
        415: Joi.any().example(Boom.unsupportedMediaType().output.payload)
          .description('Media type is not supported')
      }
    }
  },
  handler: async (request, h) => {
    const {
      fileDatabaseService: fdb,
      fileService,
    } = request.services();
    const { userId } = request.auth.credentials;
    const now = new Date();

    try {
      const aDayAgo = new Date(now.getTime() - ONE_DAY_MILLISECONDS);
      const userFilesForLastDay = await fdb.getUserFilesUploadedAfter(userId, aDayAgo);

      // Если пользователь уже загрузил больше файлов, чем установлено ограничение за сутки
      if (userFilesForLastDay.length >= config.files.limitPerUser) {
        return Boom.forbidden(errorMessages.limitReached);
      }

      const { fileStream, mimeType } = await processRawRequest(request.raw.req);
      
      if (!allowedMimeTypes.includes(mimeType)) {
        return Boom.unsupportedMediaType();
      }

      const fileDbInfo = {
        id: uuid(),
        user_id: userId,
        created_at: now,
        type: 'avatar',
        updated_at: now
      };

      const filename = await fileService.uploadS3(fileDbInfo.id, fileStream, mimeType);
      fileDbInfo.filename = filename;

      await fdb.insertFile(fileDbInfo);
      
      return {
        ...fileService.getImgproxyImageSet('avatar', filename),
        fileId: fileDbInfo.id,
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
