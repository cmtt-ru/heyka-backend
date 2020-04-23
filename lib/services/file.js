'use strict';

const Schmervice = require('schmervice');
const config = require('../../config');
const LEONARDO_UPLOAD_URL = config.leonardo.uploadUrl;
const https = require('https');
const http = require('http');
const { URL } = require('url');
/* eslint-disable-next-line */
const urlRegexp = /(?:http(s)?:\/\/)?[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:/?#[\]@!\$&'\(\)\*\+,;=.]+/gi;
const HEYKA_BOUNDARY = 'X-HEYKA-BOUNDARY';

module.exports = class FileService extends Schmervice.Service {

  constructor (...args) {
    super(...args);

    // Define request parameters
    const leonardoUrl = new URL(LEONARDO_UPLOAD_URL);
    this.requestLib = leonardoUrl.protocol === 'https' ? https : http;
    this.requestOpts = {
      method: 'post',
      hostname: leonardoUrl.hostname,
      port: leonardoUrl.protocol === 'https' ? 443 : 80,
      path: leonardoUrl.pathname
    };
  }

  /**
   * Upload file to the Leonardo and return image url
   * @param {ReadStream} fileStream File stream to upload
   * @param {string} mimetype Mime type of file
   * @returns {Promise<string>} Image url
   */
  upload (fileStream, mimeType) {
    return new Promise((resolve, reject) => {
      
      const req = this.requestLib.request(this.requestOpts, (response) => {
        if (response.statusCode !== 200) {
          return reject(new Error('Leonardo server error ' + response.statusCode));
        }
        
        // store response in data
        let data = '';

        response.on('data', chunk => {
          data += chunk;
        });

        // parse result data and return url
        response.on('end', () => {
          const resultUrl = data.match(urlRegexp)[1];
          if (!resultUrl) {
            this.server.log(['debug-error'], 'Leonardo changed result format');
            return reject(new Error('Leonardo server error (result format changed)'));
          }
          resolve(resultUrl);
        });

        response.on('error', (error) => {
          reject(error);
        });
      });

      // set multipart header
      req.setHeader('Content-Type', `multipart/form-data; boundary=${HEYKA_BOUNDARY}`);

      // write body like multipart form data
      req.write(new Buffer.from(`--${HEYKA_BOUNDARY}\n`, 'utf-8'));
      req.write(new Buffer.from('Content-Disposition: form-data; name="file[]"; filename="avatar"\n', 'utf-8'));
      req.write(new Buffer.from(`Content-Type: ${mimeType}\n\n`, 'utf-8'));

      // pass the whole file to leonardo request
      fileStream.on('data', chunk => {
        req.write(chunk);
      });

      // finish leonardo request on file end
      fileStream.on('end', () => {
        req.write(new Buffer.from('\n', 'utf-8'));
        req.write(new Buffer.from(`--${HEYKA_BOUNDARY}\n`, 'utf-8'));
        req.end();
      });
    });

  }
};
