'use strict';

const Schmervice = require('schmervice');
const Email = require('email-templates');
const { i18nForEmails } = require('./../helpers/i18n');
const config = require('../../../config');
const path = require('path');
const { MailgunWrapper } = require('./mailgun');

const VERIFICATION_PATH = '/auth/email/verify';
const JOIN_BY_INVITE_PATH = '/auth';
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
      i18nForEmails: {
        locales: ['en', 'ru'],
        directory: path.join(__dirname, './locales'),
        defaultLocale: 'ru',
        updateFiles: false,
        objectNotation: true,
      },
    });
  }

  /**
   * Send welcome mail with email verification code
   * @param {object} user User
   * @param {string} token Verification token
   */
  async sendWelcomeMail(user, token) {

    if (process.env.DISABLE_EMAIL) return;

    const buttonUrl = 'https://'
      + config.publicHostname
      + VERIFICATION_PATH
      + `?token=${token}`;
    const html = await this.emailRenderer.render('welcome-mail', {
      locale: user.lang || 'en',
      baseUrl: `https://${config.publicHostname}`,
      productName: 'Heyka',
      userName: user.name,
      supportEmail: 'support@heyka.app',
      buttonUrl,
    });

    // Prepare data before send
    const data = {
      from: `Heyka Bot <bot@${config.credentials.mailgun.domain}>`,
      to: `${user.name} <${user.email}>`,
      subject: i18nForEmails.__({ phrase: 'emails.welcomeLetter.subject', locale: user.lang || 'en' }),
      html
    };

    try {
      const start = Date.now();
      const response = await this.mg.sendHTML(data);
      console.log(`EMAIL verification code for ${user.name}. Response after ${Date.now() - start}ms`, response.data);
    } catch(e) {
      console.log(e);
      this.server.log(['error'], `Error sending email via Mailgun: ${e.toString()}`);
      throw new Error(e);
    }
  }

  /**
   * Send verification code to email
   * @param {object} user User
   * @param {string} token Verification token
   */
  async sendEmailVerificationCode(user, token) {

    if (process.env.DISABLE_EMAIL) return;

    const buttonUrl = 'https://'
      + config.publicHostname
      + VERIFICATION_PATH
      + `?token=${token}`;
      
    const html = await this.emailRenderer.render('email-verification', {
      locale: user.lang || 'en',
      baseUrl: `https://${config.publicHostname}`,
      productName: 'Heyka',
      userName: user.name,
      supportEmail: 'support@heyka.app',
      buttonUrl,
    });

    // Prepare data before send
    const data = {
      from: `Heyka Bot <bot@${config.credentials.mailgun.domain}>`,
      to: `${user.name} <${user.email}>`,
      subject: i18nForEmails.__({ phrase: 'emails.emailVerification.subject', locale: user.lang || 'en' }),
      html
    };

    try {
      const start = Date.now();
      const response = await this.mg.sendHTML(data);
      console.log(`EMAIL verification code for ${user.name}. Response after ${Date.now() - start}ms`, response.data);
    } catch(e) {
      console.log(e);
      this.server.log(['error'], `Error sending email via Mailgun: ${e.toString()}`);
      throw new Error(e);
    }
  }

  /**
   * Send an email with a join-to-workspace link 
   * @param {string} email Email address
   * @param {object} workspace Workspace info
   * @param {object} user Invite initiator user object
   * @param {string} code Full code to join the workspace 
   */
  async sendInviteToWorkspace(email, workspace, user, code) {

    if (process.env.DISABLE_EMAIL) return;
    
    const joinUrl = 'https://'
    + config.publicHostname
    + JOIN_BY_INVITE_PATH
    + `?invite=${code}`;
    const html = await this.emailRenderer.render('invite-to-workspace', {
      locale: user.lang || 'en',
      baseUrl: `https://${config.publicHostname}`,
      productName: 'Heyka',
      workspaceName: workspace.name,
      workspaceAvatar: workspace.avatar,
      userName: user.name,
      supportEmail: 'support@heyka.app',
      joinUrl,
    });

    // Prepare data before send
    const data = {
      from: `Heyka Bot <bot@${config.credentials.mailgun.domain}>`,
      to: email,
      subject: `${workspace.name} ${i18nForEmails.__({ 
        phrase: 'emails.inviteToWorkspace.subject', 
        locale: user.lang||'en' 
      })
      }`,
      html
    };

    try {
      const start = Date.now();
      const response = await this.mg.sendHTML(data);
      console.log(`EMAIL invite-to-workspace from ${user.name}. Response after ${Date.now() - start}ms`, response.data);
    } catch(e) {
      console.log(e);
      this.server.log(['error'], `Error sending email via Mailgun: ${e.toString()}`);
      throw new Error(e);
    }
  }

  /**
   * Send an email with JWT to reset password
   * @param {object} user User object (with name, email)
   * @param {string} token JWT
   */
  async sendResetPasswordToken(user, token) {

    if (process.env.DISABLE_EMAIL) return;

    const resetUrl = 'https://'
      + config.publicHostname
      + RESET_PASSWORD_PATH
      + `?token=${token}`;
    const html = await this.emailRenderer.render('reset-password', {
      locale: user.lang || 'en',
      baseUrl: `https://${config.publicHostname}`,
      productName: 'Heyka',
      userName: user.name,
      supportEmail: 'support@heyka.app',
      resetUrl,
    });

    // Prepare data before send
    const data = {
      from: `Heyka Bot <bot@${config.credentials.mailgun.domain}>`,
      to: `${user.name} <${user.email}>`,
      subject: i18nForEmails.__({ phrase: 'emails.resetPassword.subject', locale: user.lang || 'en' }),
      html
    };

    try {
      const start = Date.now();
      const response = await this.mg.sendHTML(data);
      console.log(`EMAIL password reset for ${user.name}. Response after ${Date.now() - start}ms`, response.data);
    } catch(e) {
      console.log(e);
      this.server.log(['error'], `Error sending email via Mailgun: ${e.toString()}`);
      throw new Error(e);
    }
  }
};
