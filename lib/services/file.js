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
const allowedMimeTypes = require('../schemas').allowedAvatarMimeTypes;
const S3FS = require('s3fs');
const createHmac = require('create-hmac');

const urlSafeBase64 = (string) => {
  return Buffer.from(string).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
};

const hexDecode = (hex) => Buffer.from(hex, 'hex');

const sign = (salt, target, secret) => {
  const s = `${salt}${target}`;
  console.log(s);
  const hmac = createHmac('sha256', secret);
  hmac.update(s);
  return urlSafeBase64(hmac.digest());
};

module.exports = class FileService extends Schmervice.Service {

  constructor (...args) {
    super(...args);

    // Define request parameters
    const leonardoUrl = new URL(LEONARDO_UPLOAD_URL);
    this.requestLib = leonardoUrl.protocol === 'https:' ? https : http;
    this.requestOpts = {
      method: 'post',
      hostname: leonardoUrl.hostname,
      port: leonardoUrl.protocol === 'https:' ? 443 : 80,
      path: leonardoUrl.pathname
    };

    // Define S3 bucket
    this.s3fs = new S3FS(config.files.awsBucket, {
      endpoint: config.files.awsEndpoint,
      accessKeyId: config.files.awsKey,
      secretAccessKey: config.files.awsSecret
    });
  }

  /**
   * Upload file to the Leonardo and return image url
   * @param {ReadStream} fileStream File stream to upload
   * @param {string} mimetype Mime type of file
   * @returns {Promise<string>} Image url
   */
  uploadLeonardo (fileStream, mimeType) {
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

      // handle filestream errors
      fileStream.on('error', e => {
        reject(e);
      });
    });

  }

  /**
   * Upload file to S3 storage
   * @param {string} id file id
   * @param {ReadStream} fileStream File read stream
   * @returns {Promise<string>} Filename
   */
  uploadS3(id, fileStream) {
    return new Promise((resolve, reject) => {
      let writeStream = this.s3fs.createWriteStream(id);
      fileStream.pipe(writeStream);
      fileStream.on('end', () => {
        fileStream.destroy();
        writeStream.destroy();
        fileStream = null;
        writeStream = null;
        resolve(id);
      });
    });
  }

  /**
   * Return url to imgproxy with resized image
   * @param {string} s3filename S3 filename
   * @param {number} size Size for image
   * @returns {string} Imgproxy url
   */
  getImgproxyUrl(s3filename, size) {
    const imgurl = `https://leonardo.osnova.io/794af87c-195d-c9ee-40d6-14131c4c43a6`;
    const resizing_type = 'fill';
    const width = size;
    const height = size;
    const gravity = 'no';
    const enlarge = 1;
    const extension = 'png';
    const encoded_url = urlSafeBase64(imgurl);
    const path = `/${resizing_type}/${width}/${height}/${gravity}/${enlarge}/${encoded_url}.${extension}`;
    
    console.log(config.files.imgproxySalt, config.files.imgproxyKey, path);
    const signature = sign(config.files.imgproxySalt, path, config.files.imgproxyKey);
    const result = `${config.files.imgproxyUrl}${signature}${path}`;
    return result;
  }

  /**
   * Download file from given url and return mime-type and filestream
   * @param {string} fileUrl File url to download
   * @returns {object} { mimeType, fileStream }
   */
  getFileFromUrl(fileUrl) {
    return new Promise((resolve, reject) => {
      // prepare url object
      const urlObject = new URL(fileUrl);

      // prepare http library for request (http or https)
      const requestLib = urlObject.protocol === 'https:' ? https : http;

      // make request
      const req = requestLib.request(fileUrl, response => {
        if (response.statusCode !== 200) {
          reject(new Error('Download error'));
        }
        resolve({
          mimeType: response.headers['content-type'],
          fileStream: response
        });
      });
      req.on('error', error => {
        reject(error);
      });
      req.end();
    });

  }

  /**
   * Download file from given url and upload it to the leonardo
   * @param {string} fileUrl File url to download
   * @returns {Promise<string>} Leonardo url
   */
  async uploadImageFromUrl(fileUrl) {
    const { fileStream, mimeType } = await this.getFileFromUrl(fileUrl);
    if (!allowedMimeTypes.includes(mimeType)) {
      throw new Error('MediaType is not supported!');
    }
    return await this.upload(fileStream, mimeType);
  }
};
