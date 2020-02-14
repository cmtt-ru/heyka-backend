'use strict';

const Schmervice = require('schmervice');
const mailgun = require('mailgun-js');
const config = require('../../config');
const VERIFICATION_PATH = '/verify/';

module.exports = class EmailService extends Schmervice.Service {

  constructor (...args) {
    super(...args);
    this.mg = mailgun({
      domain: config.credentials.mailgun.domain,
      apiKey: config.credentials.mailgun.apikey
    });
  }

  /**
   * Send verification code to email
   * @param {string} email Email address
   * @param {string} code Verification code
   */
  async sendEmailVerificationCode(email, code) {
    const verificationUrl = this.server.info.uri + VERIFICATION_PATH + code;
    
    // Prepare data before send
    const data = {
      from: `Heyka Bot <postmaster@${config.credentials.mailgun.domain}>`,
      to: email,
      subject: 'Email verification',
      text: 
        `To verify your email address follow the link: ${verificationUrl}`
    };

    // Send message and return promise
    return new Promise((resolve, reject) => {
      this.mg.messages().send(data, (error, body) => {
        if (error) {
          return reject(error);
        }
        return resolve(body);
      });
    });
  }
};
