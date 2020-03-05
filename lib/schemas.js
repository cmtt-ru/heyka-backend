'use strict';

const Joi = require('@hapi/joi');

const workspaceRoles = ['admin', 'moderator', 'user', 'guest'];
const idSchema = Joi.string().guid().required();
const date = Joi.date();
const avatar = Joi.string().uri().max(255);
const name = Joi.string().max(100);
const url = Joi.string().uri();
const token = Joi.string().length(50);

const user = Joi.object({
  id: idSchema,
  email: Joi.string().email().required(),
  isEmailVerified: Joi.boolean().required(),
  createdAt: date.required(),
  updatedAt: date.required()
}).label('User');

const channel = Joi.object({
  id: idSchema,
  name: name.required(),
  description: Joi.string().max(150).optional(),
  isPrivate: Joi.bool().required(),
  createdAt: date.required(),
  updatedAt: date.required()
}).label('Channel');

const workspace = Joi.object({
  id: idSchema,
  name: name.required(),
  avatar: avatar.optional(),
  createdAt: date.required(),
  updatedAt: date.required()
}).label('Workspace');

const janusServerInfo = Joi.object({
  url: url.required()
}).label('JanusServerInfo');

const workspaceUserRelation = Joi.object({
  role: Joi.string().allow(...workspaceRoles).required(),
  janusToken: token.required()
}).label('WorkspaceUserRelation');

const authCredentials = Joi.object({
  accessToken: Joi.string().required(),
  refreshToken: Joi.string().required(),
  accessTokenExpiredAt: date.required(),
  refreshTokenExpiredAt: date.required()
}).label('AuthCredentials');

exports.workspaceRoles = workspaceRoles;
exports.workspace = workspace;
exports.janusServerInfo = janusServerInfo;
exports.workspaceUserRelation = workspaceUserRelation;
exports.authCredentials = authCredentials;
exports.user = user;
exports.channel = channel;

exports.workspaceForUser = workspace.concat(Joi.object({
  janus: janusServerInfo,
  user: workspaceUserRelation
})).label('WorkspaceForUser');

exports.channelForUser = channel.concat(Joi.object({
  janus: {
    audioRoomId: Joi.number().required(),
    videoRoomId: Joi.number().required(),
    janusAuthToken: Joi.string().required()
  }
})).label('ChannelForUser');

exports.authedUser = Joi.object({
  user,
  credentials: authCredentials
}).label('AuthedUser');
