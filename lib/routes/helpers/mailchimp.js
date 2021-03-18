'use strict';
const { mailchimp: mailchimpCreds } = require('../../../config').credentials;
const cryptojs = require('crypto');
const api = require('@mailchimp/mailchimp_marketing');

api.setConfig({
  apiKey: mailchimpCreds.apikey,
  server: mailchimpCreds.apikey.split('-')[1],
});

const addMember = async (audienceId, email) => {
  const md5email = cryptojs.createHash('md5').update(email).digest('hex');
  const response = await api.lists.setListMember(
    audienceId,
    md5email,
    {
      email_address: email,
      status: 'subscribed'
    },
  );
  return response;
};

const deleteMember = async (audienceId, email) => {
  const md5email = cryptojs.createHash('md5').update(email).digest('hex');
  const response = await api.lists.deleteListMember(
    audienceId,
    md5email,
  );
  return response;
};

const totalAudienceCount = async (audienceId) => {
  const response = await api.lists.getListMembersInfo(audienceId, {
    status: 'subscribed',
    count: 1,
  });
  return response.total_items;
}; 

module.exports = {
  addMember,
  totalAudienceCount,
  deleteMember,
};
