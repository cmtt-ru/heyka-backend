'use strict';

const Schmervice = require('schmervice');
const Email = require('email-templates');
const config = require('../../../config');
const path = require('path');
const { MailgunWrapper } = require('./mailgun');

const VERIFICATION_PATH = '/verify/';
const JOIN_BY_INVITE_PATH = '/join/';
const RESET_PASSWORD_PATH = '/auth/password/reset';

module.exports = class EmailService extends Schmervice.Service {

  constructor (...args) {
    super(...args);

    // Init mailgun
    this.mg = new MailgunWrapper({
      domain: config.credentials.mailgun.domain,
      apikey: config.credentials.mailgun.apikey,
      region: 'EU',
    });

    // Init email renderer
    this.emailRenderer = new Email({
      views: {
        root: path.join(__dirname, 'templates'),
        options: {
          extension: 'ejs',
        },
      },
      i18n: {
        directory: path.join(__dirname, 'locales'),
        locales: ['en', 'ru'],
        updateFiles: false,
        objectNotation: true,
      },
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

  /**
   * Send an email with JWT to reset password
   * @param {object} user User object (with name, email)
   * @param {string} token JWT
   */
  async sendResetPasswordToken(user, token) {
    const resetUrl = 'https://'
      + 'heyka:why-so-simple-password-in-2019@'
      + config.publicHostname
      + RESET_PASSWORD_PATH
      + `?token=${token}`;
    const html = await this.emailRenderer.render('reset-password', {
      locale: user.lang || 'en',
      baseUrl: this.server.info.uri,
      productName: 'Heyka',
      userName: user.name,
      supportEmail: 'support@heyka.app',
      resetUrl,
    });

    // Prepare data before send
    const data = {
      from: `Heyka Bot <bot@${config.credentials.mailgun.domain}>`,
      to: `${user.name} <${user.email}>`,
      subject: `Reset password`,
      html
    };

    try {
      await this.mg.sendHTML(data);
    } catch(e) {
      console.log(e);
      this.server.log(['error'], `Error sending email via Mailgun: ${e.toString()}`);
      throw new Error(e);
    }
  }
};
