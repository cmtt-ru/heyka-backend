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
          console.error('Error on create platform arn ', token, arn, err.message);
          return reject(err);
        } else {
          return resolve(data.EndpointArn);
        }
      });
    });
  }

  /**
   * Send push notification directly to device
   * @param {string} deviceToken
   * @param {object} message Free form object
   * @returns {Promise<string>} Message id
   */
  async sendPushNotificationToDevice(deviceToken, message) {
    const [platform, token] = deviceToken.split('@');

    // create device endpoint
    const deviceEndpoint = await this.createDeviceEndpoint(platform, token);

    // format params
    let params;
    try {
      params = this.formatSNSParams(deviceEndpoint, message);
    } catch(e) {
      if (e.message !== 'Ingore') {
        throw e;
      }
      return;
    }

    // send notification using AWS SNS
    await this.sendSNSMessageMethod(params);

    // Delet endpoint
    await this.deleteDeviceEndpoint(deviceEndpoint);
  }

  /**
   * Method to send message by AWS SNS API
   * @param {object} params Params to send message
   */
  sendSNSMessageMethod (params) {
    return new Promise((resolve, reject) => {
      this.sns.publish(params, (err, data) => {
        if (err) {
          if (!err.message.includes('EndpointDisabled')) {
            console.error(`Push notification sending error`
              + ` (params=${JSON.stringify(params)}, error=${JSON.stringify(err)})`);
          }
          return reject(err);
        } else {
          console.log(`Push notification sent`
            + ` (params=${JSON.stringify(params)}, messageId=${data.MessageId})`);
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
          console.log('Err. message checking endpoint: ', err.message);
          if (err.toString().includes('Endpoint does not exist')) {
            return resolve(false);
          }
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
          // if endpoint is already not exists, ignore
          if (err.toString().includes('Endpoint does not exist')) {
            return resolve(true);
          }
          return reject(err);
        } else {
          return resolve(data);
        }
      });
    });
  }

  /**
   * Returns SNS API params
   * @param {string} token Endpoint token
   * @param {object} message Payload
   */
  formatSNSParams(token, message) {
    let params;

    if (token.includes('GCM')) {
      params = {
        Message: JSON.stringify(message),
        TargetArn: token,
        MessageAttributes: {
          'AWS.SNS.MOBILE.FCM.TTL': {
            DataType: 'String',
            StringValue: '40',
          },
        },
      };
    } else if (token.includes('APNS') && message.event === 'invite') {
      const payload = {
        data: message,
        "content-available": 1,
        category: "GENERAL",
        alert: 'true',
      };
      params = {
        TargetArn: token,
        Message: JSON.stringify(payload),
        MessageAttributes: {
          'AWS.SNS.MOBILE.APNS.PUSH_TYPE': {
            DataType: 'String',
            StringValue: 'voip',
          },
        }
      };
    } else if (token.includes('APNS') && message.event === 'invite-cancelled') {
      // ignore, do not send any requests
      // application will cancel voip call request by itself
      throw new Error('Ignore');
    } else {
      throw new Error('Unknow device endpoint');
    }

    return params;
  }
};
