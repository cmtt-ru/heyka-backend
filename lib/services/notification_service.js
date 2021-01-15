'use strict';

const Schmervice = require('schmervice');
const config = require('../../config');
const aws = require('aws-sdk');

module.exports = class NotificationService extends Schmervice.Service {

  constructor (...args) {
    super(...args);

    console.log('AWS SNS Endpoint: ', config.notificationService.awsEndpoint);
    this.sns = new aws.SNS({
      endpoint: config.notificationService.awsEndpoint,
      accessKeyId: config.notificationService.awsKey,
      secretAccessKey: config.notificationService.awsSecret,
      region: 'eu-central-1',
    });
  }

  /**
   * Send push notification directly to device
   * @param {string} token
   * @param {object} message Free form object
   * @returns {Promise<string>} Message id
   */
  sendPushNotificationToDevice(token, message) {
    return new Promise((resolve, reject) => {
      const publicationParams = {
        Message: JSON.stringify(message),
        TargetArn: token,
      };
      this.sns.publish(publicationParams, (err, data) => {
        if (err) {
          console.log('Попробовал отправить пуш, но не получилось, извини: ', token, message, err);
          return reject(err);
        } else {
          console.log('Пуш отправлен, лови айди его и чутка данных в пуше', token,  data.MessageId, message);
          return resolve(data.MessageId);
        }
      });
    });
  }

};
