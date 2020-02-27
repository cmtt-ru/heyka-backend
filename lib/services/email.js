'use strict';

const Schmervice = require('schmervice');
const mailgun = require('mailgun-js');
const config = require('../../config');
const VERIFICATION_PATH = '/verify/';
const JOIN_BY_INVITE_PATH = '/join/';

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

  /**
   * Send an email with a join-to-workspace link 
   * @param {string} email Email address
   * @param {string} workspaceName Workspace name
   * @param {string} code Full code to join the workspace 
   */
  async sendInviteToWorkspace(email, workspaceName, code) {
    const joinUrl = this.server.info.uri + JOIN_BY_INVITE_PATH + code;

    // Prepare data before send
    const data = {
      from: `Heyka Bot <postmaster@${config.credentials.mailgun.domain}>`,
      to: email,
      subject: `Invitation to ${workspaceName}`,
      text: 
        `You have been invited to ${workspaceName}.
        To join the workspace, follow the link: ${joinUrl}`
    };

    // Send message and return promise
    return new Promise((resolve, reject) => {
      this.mg.messages().send(data, (error, body) => {
        if (error) {
          console.log(error);
          return reject(error);
        }
        return resolve(body);
      });
    });
  }
};
