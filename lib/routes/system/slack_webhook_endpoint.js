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
      // Do not to use await, because we need to response slack immediately
      Promise.all((event.tokens.bot.map(async botId => {
        const w = await wdb.getWorkspaceBySlackBotUserId(botId);
        if (!w) return;
        await wdb.updateWorkspace(w.id, { slack: {} });
      }))).catch(err => {
        console.error(`Reset slack tokens errors`);
        console.error(err);
      });
    }

    return 'OK';
  }
});
