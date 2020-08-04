'use strict';
const createHmac = require('create-hmac');

const IMAGE_SIZES_PRESET = {
  avatar: [32, 64],
};

/**
 * Convert string to url safe base64
 * @param {string} string 
 * @returns {string}
 */
const urlSafeBase64 = (string) => {
  return Buffer.from(string).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
};

/**
 * Decode hex string
 * @param {string} hex
 * @returns {string} 
 */
const hexDecode = (hex) => Buffer.from(hex, 'hex');

/**
 * Create signature of target string according to that documentation https://docs.imgproxy.net/#/signing_the_url
 * @param {string} salt
 * @param {string} target
 * @param {string} secret
 * @returns {string}
 */
const sign = (salt, target, secret) => {
  const hmac = createHmac('sha256', hexDecode(secret));
  hmac.update(hexDecode(salt));
  hmac.update(target);
  return urlSafeBase64(hmac.digest());
};

/**
 * Return url to imgproxy with resized image
 * @param {object} config Image set config
 * @param {string} config.bucket Which s3 bucket is used
 * @param {string} config.imgproxyUrl Url for imgproxy
 * @param {string} config.imgproxyKey Imgproxy sign key
 * @param {string} config.imgproxySalt Imgproxy sign salt
 * @param {string} config.filename File object key for s3 bucket
 * @param {number} config.width image width
 * @param {number} config.height image height
 * @param {?string} config.gravity
 * @param {?number} config.enlarge
 * @param {?string} config.extension
 * @param {?string} config.resizingType
 * @returns {string}
 */
const getImgproxyUrl = function ({
  bucket,
  filename,
  width,
  height,
  imgproxySalt,
  imgproxyKey,
  imgproxyUrl,
  gravity = 'no',
  enlarge = 1,
  extension = 'png',
  resizingType = 'fill'
}) {
  const imgurl = `s3://${bucket}/${filename}`;
  const encoded_url = urlSafeBase64(imgurl);
  const path = `/${resizingType}/${width}/${height}/${gravity}/${enlarge}/${encoded_url}.${extension}`;
    
  const signature = sign(imgproxySalt, path, imgproxyKey);
  const result = `${imgproxyUrl}${signature}${path}`;
  return result;
};

/**
 * 
 * @typedef {object} ImageSize
 * @property {number} width Image width
 * @property {number} height Image height
 * 
 * @param {object} config Image set config
 * @param {string} config.bucket Which s3 bucket is used
 * @param {string} config.imgproxyUrl Url for imgproxy
 * @param {string} config.imgproxyKey Imgproxy sign key
 * @param {string} config.imgproxySalt Imgproxy sign salt
 * @param {('avatar')} config.preset Image sizes preset
 * @param {string} config.filename File object key for s3 bucket
 * @returns {object} Object with values like image32x32, image100x100 
 */
const createImageSet = function ({
  bucket,
  imgproxyUrl,
  imgproxyKey,
  imgproxySalt,
  preset,
  filename,
}) {
  const res = {};
  for (let size of IMAGE_SIZES_PRESET[preset]) {
    const key = typeof size === 'number' ? `image${size}x${size}` : `image${size.width}x${size.height}`;
    res[key] = getImgproxyUrl({
      bucket,
      imgproxyKey,
      imgproxySalt,
      imgproxyUrl,
      filename,
      width: typeof size === 'number' ? size : size.width,
      height: typeof size === 'number' ? size : size.height      
    });
  }
  return res;
};

exports.createImageSet = createImageSet;
