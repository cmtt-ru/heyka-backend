'use strict';

const HauteCouture = require('haute-couture');

exports.plugin = {
  pkg: require('../package.json'),
  register: async (server, options) => {

    await HauteCouture.using()(server, options);

    // before start hook
    await server.services().janusWorkspaceService.initJanusNodes();
  }
};
