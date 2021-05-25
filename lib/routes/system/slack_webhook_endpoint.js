'use strict';

const Helpers = require('../helpers');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/slack/event',
  options: {
    auth: false,
    tags: ['api']
  },
  handler: async (request, h) => {
    console.log('===============================');
    console.log(request.payload);
    console.log(request.query);
    const {
      challenge,
      event,
    } = request.payload;
    const {
      workspaceDatabaseService: wdb,
    } = request.server.services();

    // case for endpoint verification by slack
    if (challenge) {
      return challenge;
    }

    // react on token revoked
    if (event && event.type === 'tokens_revoked' && event.tokens.bot && event.tokens.bot.length > 0) {
      await Promise.all((event.tokens.bot.map(async botId => {
        const w = await wdb.getWorkspaceBySlackBotUserId(botId);
        if (!w) return;
        console.log(w);
        await wdb.updateWorkspace(w.id, { slack: {} });
      })));
    }

    return 'OK';
  }
});
