'use strict';

const Schmervice = require('schmervice');
const config = require('../../config');
const aws = require('aws-sdk');

module.exports = class SlackService extends Schmervice.Service {

  constructor (...args) {
    super(...args);

    this.sns = new aws.SNS({
      endpoint: config.notificationService.awsEndpoint,
      accessKeyId: config.notificationService.awsKey,
      secretAccessKey: config.notificationService.awsSecret,
    });
  }

  /**
   * Send push notification directly to device
   * @param {string} token
   * @param {object} message Free form object
   * @returns {Promise<string>} Message id
   */
  sendPushNotificationToDevice(platform, token, message) {
    return new Promise((resolve, reject) => {
      const publicationParams = {
        Message: JSON.stringify(message),
        MessageAttributes: 'String',
        TargetArn: token,
      };
      this.sns.publish(publicationParams, (err, data) => {
        if (err) {
          return reject(err);
        } else {
          return resolve(data.MessageId);
        }
      });
    });
  }

};
