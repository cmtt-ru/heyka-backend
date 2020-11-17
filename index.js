'use strict';

const createServer = require('./server');
const socket = require('./lib/socket');

async function startServer () {
  const server = await createServer();

  let monitoringWorkspaceId = '';
  if (process.env.DEPLOYMENT_ENV === 'stage') {
    monitoringWorkspaceId = '71ec6fa7-5fd5-4b8a-a6f3-738e0a951b72';
  } else if (process.env.DEPLOYMENT_ENV === 'dev') {
    monitoringWorkspaceId = 'd2b3f98c-3749-4242-b319-1416a408b6ed';
  } else {
    monitoringWorkspaceId = '6a6cac4d-6b73-460b-adc6-1df972360537';
  }
  await server.services().workspaceService.initMonitoringLoop(monitoringWorkspaceId);

  const socketIO = await socket.getSocketIO(server);
  socketIO.attach(server.listener);
  server.start();
  server.log(['info'], 'Server started');
}

startServer();
