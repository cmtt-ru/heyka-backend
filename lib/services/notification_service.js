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
   * Send notification to user using AWS SNS
   * @param {object} targetOptions Target object (need to contains device_tokens)
   * @param {array<string>} targetOptions.device_tokens List of device tokens
   * @param {object} message Any message object to send
   */
  async sendNotificationToUserDevices(targetOptions, message) {
    // check that user has device tokens
    if (targetOptions.device_tokens && targetOptions.device_tokens.length > 0) {

      const results = await Promise.allSettled(
        targetOptions.device_tokens.map(
          token => this.sendPushNotificationToDevice(token, {
            event: 'invite',
            data: message
          }))
      );

      // filter all disabled tokens
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.log(`Error on send notification to user`
            + `(token=${targetOptions.device_tokens[index]}): ${JSON.stringify(result)}`);
        }
      });
    }
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
    }

    // send notification using AWS SNS
    await this.sendSNSMessageMethod(params);

    // Delet endpoint
    await this.deleteDeviceEndpoint(deviceEndpoint);
  }

  /**
   * Method to send message by AWS SNS API
   * @param {string} token
   * @param {object} params Params to send message
   */
  sendSNSMessageMethod (token, params) {
    return new Promise((resolve, reject) => {
      this.sns.publish(params, (err, data) => {
        if (err) {
          if (!err.message.includes('EndpointDisabled')) {
            console.error(`Push notification sending error`
              + ` (token=${token}, error=${JSON.stringify(err)})`);
          }
          return reject(err);
        } else {
          console.log(`Push notification sent`
            + ` (token=${token}, messageId=${data.MessageId})`);
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
   * Add device token for user
   * 
   * @param {string} userId User id
   * @param {string} deviceToken Device token to add
   * @param {('iOS'|'Android')} platform Platform for token
   */
  async addUserDeviceToken(userId, deviceToken, platform) {
    const {
      userDatabaseService: udb,
    } = this.server.services();

    const user = await udb.findById(userId);

    if (!user) {
      throw new Error('NotFound');
    }

    if (!user.device_tokens) {
      user.device_tokens = [];
    }

      
    if (!user.device_tokens.includes(deviceToken)) {
      user.device_tokens.push(`${platform}@${deviceToken}`);
      
      await udb.updateUser(userId, {
        device_tokens: user.device_tokens,
      });
    }
  }

  /**
   * Delete device token for user
   * 
   * @param {string} userId User id
   * @param {string} deviceToken Device token to delete 
   */
  async deleteUserDeviceToken(userId, deviceToken) {
    const {
      userDatabaseService: udb,
    } = this.server.services();

    const user = await udb.findById(userId);

    if (!user) {
      throw new Error('NotFound');
    }

    if (!user.device_tokens) {
      return;
    }

      
    let index = user.device_tokens.findIndex(token => token === deviceToken.split('@')[1]);
    if (index !== -1) {
      user.device_tokens.splice(index, 1);
      
      await udb.updateUser(userId, {
        device_tokens: user.device_tokens,
      });
    }
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
      };
    } else if (token.includes('APNS') && message.event === 'invite') {
      const payload = {
        data: message,
        "content-available": 1,
        category: "GENERAL",
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
