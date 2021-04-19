'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Busboy = require('busboy');

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
      if (fieldname === 'logs') {
        // reject an error if mimetype is not supported
        if (!['application/zip'].includes(mimetype)) {
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
  path: '/logs',
  options: {
    tags: ['api', 'user'],
    description: 'Upload logs',
    payload: {
      maxBytes: 1000 * 1000 * 5, // 5 Mb
      output: 'stream',
      parse: false,
      allow: 'multipart/form-data'
    },
  },
  handler: async (request, h) => {
    const {
      fileService,
      userDatabaseService: udb,
    } = request.services();
    const { userId } = request.auth.credentials;
    const now = new Date();

    try {
      const user = await udb.findById(userId);
      const { fileStream, mimeType } = await processRawRequest(request.raw.req);

      const fileDbInfo = {
        id: `${user.name} - ${now.toUTCString()}.${mimeType.split('/')[1]}`,
      };

      const filename = await fileService.uploadS3Logs(fileDbInfo.id, fileStream, mimeType);

      return filename;
    } catch(e) {
      console.error(e);
      request.log(['debug-error'], 'Error on upload user logs: ', e);
      return Boom.internal();
    }
  }
});
