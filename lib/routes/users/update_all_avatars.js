'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');
const bcrypt = require('bcryptjs');
const secretCodeHash = '$2a$10$Cq52kqDWzK1Uwlg/461nS.SP.Wrfdl8bD4BaCx21cIFt4.IoOiVE.';
const req = require('request');
const uuid = require('uuid/v4');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/update-all-avatars',
  options: {
    auth: false,
    tags: ['api', 'user'],
    description: 'Update all avatars',
    validate: {
      payload: Joi.object({
        secretCode: Joi.string().required(),
      }),
    },
  },
  handler: async (request, h) => {
    const { 
      userDatabaseService: udb,
      fileService,
      fileDatabaseService: fdb,
    } = request.services();
    const match = bcrypt.compare(request.payload.secretCode, secretCodeHash);

    if (!match) {
      return Boom.forbidden();
    }
    
    try {
      const users = await udb.getAllUsers();
      const withNewAvatars = users.filter(u => u.avatar_file_id);
      const withOldAvatars = users.filter(u => u.avatar && !u.avatar_file_id);
      console.log(withNewAvatars, withOldAvatars);

      if (withNewAvatars.length === 0 && withOldAvatars.length === 0) {
        return 'ok';
      }

      const updateAvatarSet = async (userId, fileId) => {
        await new Promise(resolve => setTimeout(() => resolve(), Math.floor(Math.random()*10000)+100));
        const imageSet = await fileService.getImageSetForOwnedEntity('avatar', userId, fileId);
        await udb.updateUser(userId, {
          avatar_set: imageSet,
        });
      };

      const formatLeonardoAvatar = async (userId, leonardoUrl) => {
        await new Promise(resolve => setTimeout(() => resolve(), Math.floor(Math.random()*30000)+100));
        const stream = req(leonardoUrl);
        const now = new Date();
        const fileDbInfo = {
          id: uuid(),
          user_id: userId,
          created_at: now,
          type: 'avatar',
          updated_at: now
        };
        const filename = await fileService.uploadS3(fileDbInfo.id, stream);
        console.log(filename);
        fileDbInfo.filename = filename;
        await fdb.insertFile(fileDbInfo);
        const imageSet = await fileService.getImageSetForOwnedEntity('avatar', userId, fileDbInfo.id);
        console.log(imageSet);
        await udb.updateUser(userId, {
          avatar_file_id: fileDbInfo.id,
          avatar_set: imageSet,
        });
      };

      await Promise.all([
        ...withNewAvatars.map(u => updateAvatarSet(u.id, u.avatar_file_id)),
        ...withOldAvatars.map(u => formatLeonardoAvatar(u.id, u.avatar)),
      ]);
      
      return 'ok';
    } catch (e) {
      request.log(['debug-error'], 'Error on getting current user: ' + e);
      return Boom.internal();
    }
  }
});
