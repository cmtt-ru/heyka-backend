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
  avatarSet: Joi.object().optional(),
  avatarFileId: Joi.string().uuid().optional(),
  email: Joi.string().email().optional(),
  isEmailVerified: Joi.boolean().required(),
  lang: Joi.string().optional(),
  createdAt: date.required(),
  updatedAt: date.required()
}).label('UserSchema');

const channelMemberInfo = user.concat(Joi.object({
  workspaceRelation: {
    role: workspaceRoles,
  },
  channelRelation: {
    role: channelRoles,
  },
}));

const userWithConfidentialData = user.concat(Joi.object({
  socialAuth: Joi.object({
    facebook: Joi.object({
      id: Joi.string().required()
    }).optional(),
    google: Joi.object({
      id: Joi.string().required()
    }).optional(),
    slack: Joi.object({
      id: Joi.string().required()
    }).optional()
  }).required(),
  appSettings: Joi.object().required(),
}));

const channel = Joi.object({
  id: idSchema,
  name: name.required(),
  description: Joi.string().max(150).optional(),
  creatorId: Joi.string().uuid().required(),
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
  avatarFileId: Joi.string().uuid().optional(),
  avatarSet: Joi.object().optional(),
  createdAt: date.required(),
  updatedAt: date.required(),
  slack: Joi.object({
    id: Joi.string().required(),
    name: Joi.string().required(),
  }).optional(),
}).label('WorkspaceSchema');

const invite = Joi.object({
  id: idSchema,
  workspaceId: idSchema,
  channelId: Joi.string().uuid().optional(),
  createdAt: date.required(),
  updatedAt: date.required(),
  expiredAt: date.required(),
  createdBy: idSchema,
  code: Joi.string().required(),
});

const userMediaState = Joi.object({
  microphone: Joi.boolean().required(),
  speakers: Joi.boolean().required(),
  screen: Joi.boolean().required(),
  camera: Joi.boolean().required(),
  speaking: Joi.boolean().required(),
  startScreenTs: Joi.date().optional(),
  startCameraTs: Joi.date().optional(),
  startSpeakingTs: Joi.date().optional(),
}).label('UserMediaStateSchema');

const janusServerInfo = Joi.object({
  url: url.required()
}).label('JanusServerInfoSchema');

const workspaceUserRelation = Joi.object({
  role: Joi.string().allow(...workspaceRoles).required(),
}).label('WorkspaceUserRelation');

const channelUserRelation = Joi.object({
  role: Joi.string().allow(...channelRoles).required(),
  usageCount: Joi.number().required(),
  latestUsage: Joi.date().optional(),
});

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
exports.channelUserRelation = channelUserRelation;
exports.authCredentials = authCredentials;
exports.user = user;
exports.channelMemberInfo = channelMemberInfo;
exports.invite = invite;
exports.channel = channel;
exports.userMediaState = userMediaState;
exports.userMediaStateWithId = userMediaState.concat(Joi.object({
  userId: idSchema
})).label('UserMediaState');

exports.workspaceForUser = workspace.concat(Joi.object({
  userRelation: workspaceUserRelation
})).label('WorkspaceForUser');

exports.channelForUser = channel.concat(Joi.object({
  userRelation: channelUserRelation,
  users: Joi.array().items(this.userMediaStateWithId).required()
})).label('ChannelForUser');

exports.authedUser = Joi.object({
  user: userWithConfidentialData,
  credentials: authCredentials
}).label('AuthedUser');

exports.fullWorkspaceStateUser = user.concat(Joi.object({
  onlineStatus: Joi.string().allow('online', 'offline', 'idle').required(),
  role: Joi.string().allow(...workspaceRoles).required(),
  timeZone: Joi.string().example('Europe/Moscow').optional(),
  callsCount: Joi.number().required(),
  latestCall: Joi.date().optional(),
}));

exports.workspaceMembersForAdmin = user.concat(Joi.object({
  role: Joi.string().allow(...workspaceRoles).required(),
  latestActivityAt: Joi.alternatives(Joi.date(), Joi.valid(null)).required(),
}));

exports.userWithConfidentialData = userWithConfidentialData;
