'use strict';

const axios = require('axios').default;
const FormData = require('form-data');

class MailgunWrapper {

  /**
   * Construct Mailgun wrapper
   * 
   * @param {object} opts Mailgun opts
   * @param {string} opts.domain Mailgun domain
   * @param {string} opts.apikey Mailgun apikey
   * @param {('EU'|'US')} opts.region Mailgun region
   */
  constructor ({
    domain,
    apikey,
    region
  }) {
    this.axios = axios.create({
      baseURL: `https://api.${ region === 'EU' ? 'eu.' : '' }mailgun.net/v3/${domain}/`,
      auth: {
        username: 'api',
        password: apikey
      },
    });
  }

  /**
   * Send html message to specific email
   * @param {object} opts Message opts
   * @param {string} opts.to Addressee Name <his.email@address.ru>
   * @param {string} opts.from Addresser Name <his.email@address.ru>
   * @param {string} opts.html HTML
   * @param {string} opts.subject mail subject
   */
  async sendHTML({
    to,
    from,
    subject,
    html
  }) {
    const form = new FormData();
    form.append('from', from);
    form.append('to', to);
    form.append('subject', subject);
    form.append('html', html);
    return await this.axios.post('messages', form, {
      headers: form.getHeaders(),
    });
  }
}

exports.MailgunWrapper = MailgunWrapper;
