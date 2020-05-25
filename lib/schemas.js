'use strict';

const Joi = require('@hapi/joi');

const workspaceRoles = ['admin', 'moderator', 'user', 'guest'];
const channelRoles = ['admin', 'moderator', 'user'];
const idSchema = Joi.string().guid().required();
const date = Joi.date().example(new Date());
const avatar = Joi.string().uri().max(255);
const name = Joi.string().max(100);
const url = Joi.string().uri();
const boomError = Joi.object({
  statusCode: Joi.number().required().description('HTTP Status Code'),
  error: Joi.string().required().description('Error name'),
  message: Joi.string().required().description('Error description')
});
const allowedAvatarMimeTypes = [
  'image/png',
  'image/jpg',
  'image/jpeg',
  'image/webp'
];

const user = Joi.object({
  id: idSchema,
  name: Joi.string().max(100).required(),
  avatar: Joi.string().uri().optional(),
  email: Joi.string().email().required(),
  isEmailVerified: Joi.boolean().required(),
  createdAt: date.required(),
  updatedAt: date.required()
}).label('UserSchema');

const userWithConfidentialData = user.concat(Joi.object({
  facebookAuth: Joi.object({
    id: Joi.string().required()
  }).optional(),
  googleAuth: Joi.object({
    id: Joi.string().required()
  }).optional(),
  slackAuth: Joi.object({
    id: Joi.string().required()
  }).optional()
}));

const channel = Joi.object({
  id: idSchema,
  name: name.required(),
  description: Joi.string().max(150).optional(),
  isPrivate: Joi.bool().required(),
  isTemporary: Joi.bool().required(),
  expiredAt: date.optional(),
  createdAt: date.required(),
  updatedAt: date.required()
}).label('ChannelSchema');

const workspace = Joi.object({
  id: idSchema,
  name: name.required(),
  avatar: avatar.optional(),
  createdAt: date.required(),
  updatedAt: date.required()
}).label('WorkspaceSchema');

const userMediaState = Joi.object({
  microphone: Joi.boolean().required(),
  speakers: Joi.boolean().required(),
  screen: Joi.boolean().required(),
  camera: Joi.boolean().required(),
  speaking: Joi.boolean().required()
}).label('UserMediaStateSchema');

const janusServerInfo = Joi.object({
  url: url.required()
}).label('JanusServerInfoSchema');

const workspaceUserRelation = Joi.object({
  role: Joi.string().allow(...workspaceRoles).required(),
}).label('WorkspaceUserRelation');

const authCredentials = Joi.object({
  accessToken: Joi.string().required(),
  refreshToken: Joi.string().required(),
  accessTokenExpiredAt: date.required(),
  refreshTokenExpiredAt: date.required()
}).label('AuthCredentials');

exports.allowedAvatarMimeTypes = allowedAvatarMimeTypes;
exports.boomError = boomError;
exports.workspaceRoles = workspaceRoles;
exports.channelRoles = channelRoles;
exports.workspace = workspace;
exports.janusServerInfo = janusServerInfo;
exports.workspaceUserRelation = workspaceUserRelation;
exports.authCredentials = authCredentials;
exports.user = user;
exports.channel = channel;
exports.userMediaState = userMediaState;
exports.userMediaStateWithId = userMediaState.concat(Joi.object({
  userId: idSchema
})).label('UserMediaState');

exports.workspaceForUser = workspace.concat(Joi.object({
  user: workspaceUserRelation
})).label('WorkspaceForUser');

exports.channelForUser = channel.concat(Joi.object({
  role: Joi.string().allow(...channelRoles).required(),
  users: Joi.array().items(this.userMediaStateWithId).required()
})).label('ChannelForUser');

exports.authedUser = Joi.object({
  user: userWithConfidentialData,
  credentials: authCredentials
}).label('AuthedUser');

exports.userWithOnlineStatus = user.concat(Joi.object({
  onlineStatus: Joi.string().allow('online', 'offline', 'idle').required(),
  timeZone: Joi.string().example('Europe/Moscow').optional()
}));

exports.userWithConfidentialData = userWithConfidentialData;
