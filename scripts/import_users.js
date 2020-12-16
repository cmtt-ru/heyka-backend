'use strict';

const { promises: fs, existsSync } = require('fs');
const createServer = require('../server');
const path = require('path');
const mockery = require('mockery');
const Schmervice = require('schmervice');
const pathToEmailService = path.resolve(__dirname, '../lib/services/email.js');

mockery.enable({
  warnOnReplace: true,
  warnOnUnregistered: false // disable warnings on unmocked modules
});
mockery.registerMock(
  pathToEmailService,
  class EmailService extends Schmervice.Service {
    sendEmailVerificationCode() {
    }
    sendInviteToWorkspace() {
    }
  }
);

const files = {
  channels: path.join(__dirname, './data/channels.json'),
  users: path.join(__dirname, './data/users.json'),
  output: path.join(__dirname, './data/output.txt')
};


async function importUsers () {
  try {
    if (!existsSync(files.users)) {
      throw new Error('Put the correct users.json file in scripts/data directory');
    }
    if (!existsSync(files.channels)) {
      throw new Error('Put the correct channels.json file in scripts/data directory');
    }

    let users = JSON.parse(await fs.readFile(files.users));
    let channels = JSON.parse(await fs.readFile(files.channels));

    // add email addresses for users
    users = users.map(user => ({
      ...user,
      email: `user${user.id}@example.com`,
      password: 'heyka-password',
    }));

    // create server
    const server = await createServer();
    const {
      userService,
      workspaceService
    } = server.services();

    // sign up all users to the heyka server
    const signedUpUsers = await Promise.all(
      users.map(user => userService.signup({
        name: user.name,
        avatar: user.avatar,
        email: user.email,
        password: user.password
      }))
    );
    console.log(`Added ${signedUpUsers.length} users`);

    // create workspace "Комитет"
    const { workspace } = await workspaceService.createWorkspace(signedUpUsers[0], 'Комитет');
    console.log(`Workspace created`);

    // add all users except the first one to the workspace
    await Promise.all(signedUpUsers.slice(1).map(user => workspaceService.addUserToWorkspace(workspace.id, user.id)));
    console.log(`Users added to the created workspace`);

    // create public channels
    const wId = workspace.id;
    const adminId = signedUpUsers[0].id;
    const createdChannels = await Promise.all(channels.map(channel => workspaceService.createChannel(wId, adminId, {
      name: channel.name,
      isPrivate: false
    })));
    console.log(`Created ${createdChannels.length} channels`);


    // create auth link for all users
    const authCodes = await Promise.all(signedUpUsers.map(user => userService.createAuthLink(user.id)));
    console.log(`Auth codes for all users created`);

    let output = '';
    signedUpUsers.forEach((user, index) => {
      output += `${user.name}: ${authCodes[index]}\n`;
    });
    await fs.writeFile(files.output, output, 'utf8');

    console.log('Done!');
    process.exit(0);
  } catch(e) {
    console.log('Error:');
    console.log(e);
    process.exit(1);
  }
}

importUsers();
