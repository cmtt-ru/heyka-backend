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
   * Creates platform endpoints for current device and platform
   * @param {('iOS'|'Android')} platform iOS, Android
   * @param {string} token Device token
   * @returns {Promise<string>}
   */
  createDeviceEndpoint(platform, token) {
    return new Promise((resolve, reject) => {
      const arn = platform === 'iOS' ? config.notificationService.appleArn : config.notificationService.androidArn;
      const params = {
        PlatformApplicationArn: arn,
        Token: token,
      };
      this.sns.createPlatformEndpoint(params, (err, data) => {
        if (err) {
          console.log('ОШИБКА при создании platform arn: ', token, arn, err);
          return reject(err);
        } else {
          console.log('Platform arn создан, поздравляю: ', token,  data.EndpointArn);
          return resolve(data.EndpointArn);
        }
      });
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
      let params = null;

      if (token.includes('GCM')) {
        params = {
          Message: JSON.stringify(message),
          TargetArn: token,
        };
      } else if (token.includes('APNS') && message.event === 'invite') {
        const payload = {
          default: 'Silent voip push notification',
          APNS_VOIP: {
            aps: {
              alert: {
                title: 'Call request',
              },
              data: message,
              'content-available': 1,
              category: 'GENERAL',
            }
          }
        };
        payload.APNS_VOIP = JSON.stringify(payload.APNS_VOIP);
        params = {
          Message: JSON.stringify(payload),
          MessageStructure: 'json',
          MessageAttributes: {
            'AWS.SNS.MOBILE.APNS.PUSH_TYPE': {
              DataType: 'String',
              StringValue: 'voip',
            },
            'AWS.SNS.MOBILE.APNS.PRIORITY': {
              DataType: 'String',
              StringValue: '10',
            }
          }
        };
      } else if (token.includes('APNS') && message.event === 'invite-cancelled') {
        // ignore, do not send any requests
        // application will cancel voip call request by itself
        return resolve('IgnoreIOSCancellRequest');
      } else {
        throw new Error('Unknow device endpoint');
      }

      this.sns.publish(params, (err, data) => {
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

  /**
   * Check each endpoint from array of enabling status
   * @param {array<string>} endpoints List of endpoints
   * @returns {array<string>} Array of disabled tokens
   */
  async getDisabledEndpoints(endpoints) {
    const isEndpointEnabled = (endpointArn) => new Promise((resolve, reject) => {
      this.sns.getEndpointAttributes({
        EndpointArn: endpointArn,
      }, (err, data) => {
        if (err) {
          return reject(err);
        } else {
          return resolve(data.Attributes['Enabled']);
        }
      });
    });
    const enabledStatus = await Promise.all(endpoints.map(endpoint => isEndpointEnabled(endpoint)));
    const result = [];
    for (let i = 0; i < enabledStatus.length; ++i) {
      if (!enabledStatus[i]) {
        result.push(endpoints[i]);
      }
    }
    return result;
  }

  /**
   * Deletes endpoint
   * @param {string} endpoint Endpoint to delete
   */
  deleteDeviceEndpoint(endpoint) {
    return new Promise((resolve, reject) => {
      this.sns.deleteEndpoint({
        EndpointArn: endpoint,
      }, (err, data) => {
        if (err) {
          return reject(err);
        } else {
          return resolve(data);
        }
      });
    });
  }

};
