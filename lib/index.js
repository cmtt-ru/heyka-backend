'use strict';

const HauteCouture = require('haute-couture');
const path = require('path');

const serveHtmlFile = (route, filename) => ({
  method: 'GET',
  path: route,
  options: {
    auth: false 
  },
  handler: {
    file: path.join(__dirname, '../client/dist/', filename)
  }
});

exports.plugin = {
  pkg: require('../package.json'),
  register: async (server, options) => {

    await HauteCouture.using()(server, options);

    server.route(serveHtmlFile('/', 'index.html'));
    server.route(serveHtmlFile('/auth', 'app.html'));
    server.route(serveHtmlFile('/guest', 'app.html'));
    server.route({
      method: 'GET',
      path: '/{file*}',
      options: {
        auth: false
      },
      handler: {
        directory: {
          path: path.join(__dirname, '../client/dist/')
        }
      }
    });

    // before start hook
    try {
      await server.services().janusWorkspaceService.initJanusNodes();
    } catch (e) {
      server.log(['debug-error'], 'Error on initJanusNodes: ', e);
      throw e;
    }
  }
};
