'use strict';

const Schmervice = require('schmervice');
const uuid4 = require('uuid/v4');
const bcrypt = require('bcryptjs');
const crypto = require('crypto-promise');
const { URL } = require('url');
const config = require('../../config');
const LeonardoUrlObject = new URL(config.leonardo.staticServerUrl);
const helpers = require('./helpers');
const SALT_ROUNDS = 8;
const NO_MESSAGE_RESPONSE_TIMEOUT = 40000;
const jwt = require('jsonwebtoken');

/**
 * INCREASE ACCESS TOKEN LIFESPAN WHILE TESTING
 */
const ACCESS_TOKEN_LIFESPAN = parseInt(process.env.ACCESS_TOKEN_LIFESPAN || 3600000);
const REFRESH_TOKEN_LIFESPAN = parseInt(process.env.REFRESH_TOKEN_LIFESPAN || 2678400000);
const EMAIL_VERIFICATION_CODE_LIFESPAN = parseInt(process.env.EMAIL_VERIFICATION_CODE_LIFESPAN || 3600000);
const AUTH_LINK_LIFESPAN = parseInt(process.env.AUTH_LINK_LIFESPAN || 600000);
const RESET_PWD_JWT_LIFESPAN_MS = parseInt(process.env.RESET_PWD_JWT_LIFESPAN || 24 * 60 * 60 * 1000);

module.exports = class UserService extends Schmervice.Service {

  constructor (...args) {
    super(...args);
  }

  /**
   * Returns found user or null
   * @param {string} email
   * @returns {?object} Object represents a found user 
   */
  async findByEmail (email) {
    const user = await this.server.services().userDatabaseService.findByEmail(email);
    return user;
  }

  /**
   * Returns found user or null
   * @param {uuid} id
   * @returns {?object} Object represents a found user 
   */
  async findById (id) {
    const user = await this.server.services().userDatabaseService.findById(id);
    return user;
  }

  /**
   * Returns found user or null
   * @param {string} externalAuthenticator google|slack|facebook ...
   * @param {string} id 
   * @returns {?object} Object represents a found user
   */
  async findByExternalAuthenticatorId (externalAuthenticator, id) {
    const { userDatabaseService } = this.server.services();
    const user = await userDatabaseService.findByExternalAuthenticatorId(externalAuthenticator, id);
    return user;
  }

  /**
   * Signs up user
   * @param {object} userInfo Object with signup details
   * @returns {object} Ready to use user object
   */
  async signup (userInfo) {
    const {
      userDatabaseService,
      emailService
    } = this.server.services();
    let user;
    
    if (userInfo.email) {
      user = await userDatabaseService.findByEmail(userInfo.email);
      if (user) throw new Error('EmailExists');
    }
    
    const id = uuid4();
    const now = new Date();
    let passwordSalt, passwordHash;
    // hash password if it is email-password sign up
    if (userInfo.password) {
      passwordSalt = await bcrypt.genSalt(SALT_ROUNDS);
      passwordHash = await bcrypt.hash(userInfo.password, passwordSalt);
    }
    user = {
      id,
      email: userInfo.email,
      name: userInfo.name,
      avatar: userInfo.avatar,
      is_email_verified: false,
      lang: userInfo.lang,
      password_hash: passwordHash,
      password_salt: passwordSalt,
      created_at: now,
      updated_at: now,
      auth: userInfo.auth || {}
    };
    await userDatabaseService.insert(user);

    // create email verification code and send it to email
    // if it is email-password sign up
    if (userInfo.email && !userInfo.auth) {
      const code = await this.createEmailVerificationCode(id, userInfo.email);
      /** DO NOT SEND EMAIL IN DEVELOPMENT MODE */
      if (process.env.NODE_ENV !== 'development') {
        await emailService.sendEmailVerificationCode(userInfo.email, code);
      } 
    }
    
    return user;
  }

  /**
   * Checks password and returns user object
   * @param {object} userInfo Sign in details (email, password)
   * @returns {object} User object from the database
   */
  async signin (userInfo) {
    const { userDatabaseService } = this.server.services();
    let user = await userDatabaseService.findByEmail(userInfo.email);
    if (!user) throw new Error('UserNotFound');
    if (!user.password_hash) throw new Error('InvalidPassword');
    const match = await bcrypt.compare(userInfo.password, user.password_hash);
    if (!match) throw new Error('InvalidPassword');
    return user;
  }

  /**
   * Send user email with change password link
   * @param {string} email Email of user that wants to reset password
   */
  async resetPasswordInit (email) {
    const {
      userDatabaseService: udb,
      emailService,
    } = this.server.services();

    const user = await udb.findByEmail(email);

    if (!user) {
      throw new Error('UserNotFound');
    }

    if (!user.is_email_verified) {
      throw new Error('EmailNotVerified');
    }

    const token = jwt.sign({
      userId: user.id,
      action: 'resetPassword'
    }, config.jwt_secret, {
      expiresIn: RESET_PWD_JWT_LIFESPAN_MS / 1000
    });

    await emailService.sendResetPasswordToken(user, token);
  }

  /**
   * Resetting password permitted by JWT
   * @param {string} token JWT
   * @param {string} password New user password
   */
  async resetPassword (token, password) {
    const {
      userDatabaseService: udb,
    } = this.server.services();
    
    let data = null;
    
    try {
      data = jwt.verify(token, config.jwt_secret);
    } catch(e) {
      throw new Error('TokenIsInvalid');
    }

    if (data.action !== 'resetPassword') {
      throw new Error('TokenIsInvalid');
    }

    const user = await udb.findById(data.userId);

    if (!user) {
      throw new Error('UserNotFound');
    }

    const passwordSalt = await bcrypt.genSalt(SALT_ROUNDS);
    const passwordHash = await bcrypt.hash(password, passwordSalt);

    const updateUserData = {
      password_salt: passwordSalt,
      password_hash: passwordHash
    };

    await udb.updateUser(user.id, updateUserData);
  }

  /**
   * Updates user profile
   * @param {string} userId User id
   * @param {object} info User info
   */
  async updateProfile(userId, info) {
    const {
      userDatabaseService: udb,
      workspaceDatabaseService: wdb,
      apiEventService,
      fileService
    } = this.server.services();
      // if avatar is not hosted on leonardo, upload it to the leonardo
    if (info.avatar) {
      const avatarUrlObj = new URL(info.avatar);
      if (avatarUrlObj.hostname !== LeonardoUrlObject.hostname) {
        const leonardoAvatarUrl = await fileService.uploadImageFromUrl(info.avatar);
        info.avatar = leonardoAvatarUrl;
      }
    }
    await udb.updateUser(userId, info);

    const user = await udb.findById(userId);

    if (!user) {
      throw new Error('UserNotFound');
    }
    
    // collect users whose should be notified about update
    const userWorkspaces = await wdb.getWorkspacesByUserId(userId);
    apiEventService.userUpdated(userWorkspaces, user);

    return user;
  }

  /**
   * Verify JWT and return boolean result
   * @param {string} token JWT
   */
  async validateJWT(token) {
    try {
      jwt.verify(token, config.jwt_secret);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Returns result of token validation and a cause of fail
   * @param {string} token Access token
   */
  async isTokenValid (token) {
    const tokenInfo = await this.findAccessToken(token);
    if (!tokenInfo) {
      return { result: false, cause: 'NotFound' };
    }

    if (!tokenInfo.expired || Date.now() > tokenInfo.expired) {
      return { result: false, cause: 'Expired' };
    }

    return { result: true, tokenInfo };
  }

  /**
   * Creates auth tokens for a certain user.
   * Access token is kept by Redis
   * Refresh token is kept by postgres database
   * @param {object} user User the tokens for are created
   * @param {*} accessTokenLifespan How long the access_token will be valid (ms)
   * @param {*} refreshTokenLifespan How long the refresh_token will be valid (ms)
   * @return {object} { access, refresh }
   */
  async createTokens (
    user,
    accessTokenLifespan = ACCESS_TOKEN_LIFESPAN, 
    refreshTokenLifespan = REFRESH_TOKEN_LIFESPAN
  ) {
    const { userDatabaseService } = this.server.services();
    const [ access, refresh ] = await Promise.all([
      this.createAccessToken(user, accessTokenLifespan),
      helpers.getRandomCode(64)
    ]);
    const now = new Date();
    const expired_at = new Date(Date.now() + refreshTokenLifespan);
    const refreshTokenInfo = {
      id: uuid4(),
      expired_at,
      created_at: now,
      refreshed_at: now,
      user_id: user.id,
      access_token: access,
      refresh_token: refresh,
    };
    await userDatabaseService.insertSession(refreshTokenInfo);
    return {
      accessToken: access,
      refreshToken: refresh,
      accessTokenExpiredAt: new Date(Date.now() + accessTokenLifespan),
      refreshTokenExpiredAt: refreshTokenInfo.expired_at
    };
  }

  /**
   * Creates access token and saves it to Redis
   * @param {object} user User
   * @param {number} accessTokenLifespan How long access_token will be valid
   */
  async createAccessToken (user, accessTokenLifespan = ACCESS_TOKEN_LIFESPAN) {
    const { userDatabaseService } = this.server.services();
    const access = await helpers.getRandomCode(64);
    const info = {
      expired: Date.now() + accessTokenLifespan,
      userId: user.id
    };
    await userDatabaseService.insertAccessToken(access, info);
    return access;
  }

  /**
   * Finds access token in Redis and returns info
   * @param {string} token Access token
   * @returns {object} Object with access token info
   */
  async findAccessToken (token) {
    const { userDatabaseService } = this.server.services();
    return userDatabaseService.findAccessToken(token);
  }

  /**
   * Finds refresh token in database and returns info
   * @param {string} token Refresh token
   * @returns {object} Object with refresh token info
   */
  async findRefreshToken (token) {
    const { userDatabaseService } = this.server.services();
    return userDatabaseService.findSession(token);
  }

  /**
   * Deletes access token from Redis
   * @param {string} token Access token
   */
  async deleteAccessToken (token) {
    const { userDatabaseService } = this.server.services();
    await userDatabaseService.deleteAccessToken(token);
  }

  /**
   * Deletes refresh token and finds and deleted access token that is belong to refresh token.
   * @param {string} token Refresh token
   */
  async deleteRefreshToken (token) {
    const { userDatabaseService } = this.server.services();
    const sessionInfo = await userDatabaseService.findSession(token);
    if (!sessionInfo) return;
    await Promise.all([
      userDatabaseService.deleteAccessToken(sessionInfo.access_token),
      userDatabaseService.deleteSession(token)
    ]);
  }

  /**
   * Updates refresh token and recreates access token
   * @param {string} accessToken Access token
   * @param {string} refreshToken Refresh token
   * @param {*} accessTokenLifespan How long the access_token will be valid (ms)
   * @param {*} refreshTokenLifespan How long the refresh_token will be valid (ms)
   * @returns {object} Access and refresh token
   */
  async refreshToken (
    accessToken, 
    refreshToken, 
    accessTokenLifespan = ACCESS_TOKEN_LIFESPAN, 
    refreshTokenLifespan = REFRESH_TOKEN_LIFESPAN
  ) {
    const { userDatabaseService } = this.server.services();
    const tokenInfo = await userDatabaseService.findSession(refreshToken);
    // Refresh token is not found, throw error
    if (!tokenInfo) throw new Error('RefreshTokenNotFound');
    // Access token and refresh token should be matched with that are sent by user
    if (tokenInfo.access_token !== accessToken) throw new Error('AccessTokenNotMatched');
    // Found refresh token can't be expired
    if (new Date(tokenInfo.expired_at).getTime() < new Date().getTime()) throw new Error('RefreshTokenExpired');
    await userDatabaseService.deleteAccessToken(accessToken);
    const user = await userDatabaseService.findById(tokenInfo.user_id);
    const access = await this.createAccessToken(user, accessTokenLifespan);
    const refresh = uuid4();
    const updateRefreshToken = {
      refresh_token: refresh,
      access_token: access,
      expired_at: new Date(Date.now() + refreshTokenLifespan),
      refreshed_at: new Date()
    };
    await userDatabaseService.updateSession(tokenInfo.id, updateRefreshToken);
    return {
      accessToken: access,
      refreshToken: refresh,
      accessTokenExpiredAt: new Date(Date.now() + accessTokenLifespan),
      refreshTokenExpiredAt: updateRefreshToken.expired_at
    };
  }

  /**
   * Updates online status of user and notify all in workspace
   * @param {String} userId User id
   * @param {string} workspaceId Workspace id
   * @param {String} onlineStatus Online status (online, idle, offline)
   */
  async updateOnlineStatus(userId, socketId, onlineStatus) {
    const {
      apiEventService,
      connectionService
    } = this.server.services();

    const connection = await connectionService.getConnection(socketId);
    if (!connection) {
      throw new Error('ConnectionNotFound');
    }

    connection.onlineStatus = onlineStatus;
    await connectionService.setConnectionObject(connection);

    // notify about new online status
    apiEventService.onlineStatusUpdated(userId, connection.workspaceId, onlineStatus);
  }

  /**
   * Creates verification code and returns full code
   * that should be returned to the user
   * @param {string} userId User id
   * @param {string} email Email
   */
  async createEmailVerificationCode (userId, email) {
    const {
      verificationCodesDatabaseService: dbService
    } = this.server.services();
    const code = (await crypto.randomBytes(25)).toString('hex');
    const now = new Date();
    const codeData = {
      id: uuid4(),
      user_id: userId,
      email,
      code,
      created_at: now,
      updated_at: now,
      expired_at: new Date(now.getTime() + EMAIL_VERIFICATION_CODE_LIFESPAN)
    };
    await dbService.insertVerificationCode(codeData);
    return helpers.codeConvertToUrl(codeData.id, code);
  }

  /**
   * Check verification code and update user set email verified
   * @param {string} fullCode Full code (id+code)
   */
  async verifyEmailAddress(fullCode) {
    const {
      userDatabaseService,
      verificationCodesDatabaseService: codeDbService
    } = this.server.services();
    const { id, code } = helpers.urlConvertToCode(fullCode);
    const verificationCode = await codeDbService.getVerificationCodeById(id);
    if (!verificationCode) {
      throw new Error('NotFound');
    }
    if (verificationCode.code !== code) {
      throw new Error('VerificationCodesNotMatched');
    }
    const user = await userDatabaseService.findById(verificationCode.user_id);
    if (!user) {
      throw new Error('UserNotFound');
    }
    if (user.email !== verificationCode.email) {
      throw new Error('EmailNotMatched');
    }
    const now = new Date();
    const codeExpired = new Date(verificationCode.expired_at);
    if (now > codeExpired) {
      throw new Error('VerificationCodeExpired');
    }
    // update user in the database
    await userDatabaseService.updateUser(user.id, { is_email_verified: true });
    // delete verification code from the database
    await codeDbService.deleteVerificationCode(id);
  }

  /**
   * Creates auth link for the user
   * @param {string} userId User id
   */
  async createAuthLink(userId) {
    const { authLinksDatabaseService: authLinks } = this.server.services();
    const code = await helpers.getRandomCode(50);
    const now = new Date();
    const authLinkInfo = {
      id: uuid4(),
      user_id: userId,
      code,
      created_at: now,
      updated_at: now,
      expired_at: new Date(now.getTime() + AUTH_LINK_LIFESPAN)
    };
    await authLinks.insertAuthLink(authLinkInfo);
    return helpers.codeConvertToUrl(authLinkInfo.id, code);
  }

  /**
   * Checks auth link (is it not expired, is it valid, is user existed)
   * @param {string} fullCode Full code (id+code)
   * @returns {object} { isValid: boolean, user: UserObject }
   */
  async checkAuthLink(fullCode) {
    const {
      authLinksDatabaseService: authLinks,
      userDatabaseService: udb
    } = this.server.services();
    const { id, code } = helpers.urlConvertToCode(fullCode);
    const authLink = await authLinks.getAuthLinkById(id);
    
    if (!authLink) return { isValid: false, user: null };
    if (authLink.code !== code) return { isValid: false, user: null };
    if (new Date() > new Date(authLink.expired_at)) return { isValid: false, user: null };

    const user = await udb.findById(authLink.user_id);
    if (!user) return { isValid: false, user: null };
    return { isValid: true, user };
  }

  /**
   * Send invites between users
   * 
   * @param {string} fromUserId Sender user id
   * @param {string} toUserId Receiver user id
   * @param {boolean} isResponseNeeded Whether receiver should provide the answer
   * @param {string} workspaceId Workspace id
   * @param {string} channelId Channel id
   * @param {object} message Message data
   * @param {string} message.type Type of message
   * @param {object} message.data Message data
   * @returns {string} Invite id
   */
  async sendInvite({
    fromUserId,
    toUserId,
    isResponseNeeded,
    message,
    workspaceId,
    channelId,
  }) {
    const {
      messageDatabaseService,
      connectionService,
      apiEventService,
      workspaceService,
      permissionService,
    } = this.server.services();
    const userConnections = await connectionService.getAllUserConnections(toUserId);

    if (userConnections.length === 0) {
      throw new Error('UserNotConnected');
    }

    // check if user has access for this channel
    const canSelectChannel = await permissionService.canSelectChannel(channelId, toUserId);
    if (!canSelectChannel) {
      await workspaceService.addMembersToChannel(channelId, workspaceId, [toUserId]);
    }

    // generate unique message id
    const messageInfo = helpers.withTimestamp({
      id: uuid4(),
      from_user_id: fromUserId,
      to_user_id: toUserId,
      workspace_id: workspaceId,
      channel_id: channelId,
      data: message
    }, new Date());

    // notify user about message
    apiEventService.sendInvite({
      toUserId,
      fromUserId,
      messageId: messageInfo.id,
      workspaceId,
      channelId,
      isResponseNeeded,
      message
    });

    if (isResponseNeeded) {
      // save message to the database
      await messageDatabaseService.addMessage(messageInfo);

      // wait some time before notify about no response
      const waitTimeout = process.env.NO_MESSAGE_RESPONSE_TIMEOUT
        ? parseInt(process.env.NO_MESSAGE_RESPONSE_TIMEOUT, 10)
        : NO_MESSAGE_RESPONSE_TIMEOUT;
      setTimeout(async () => {
        const m = await messageDatabaseService.getMessage(messageInfo.id);
        
        // if message in the database
        // notify about no response
        // and delete message 
        if (m) {
          apiEventService.noInviteResponse(fromUserId, toUserId, messageInfo.id);
          await messageDatabaseService.deleteMessage(messageInfo.id);
        }
      }, waitTimeout);
    }

    return messageInfo.id;
  }

  /**
   * Send response for specific invite
   * 
   * @param {string} inviteId Invite id for response
   * @param {object} response Response data
   */
  async responseInvite(inviteId, response) {
    const {
      messageDatabaseService,
      apiEventService
    } = this.server.services();

    const message = await messageDatabaseService.getMessage(inviteId);

    if (!message) {
      throw new Error('NotFound');
    }

    await messageDatabaseService.deleteMessage(inviteId);

    apiEventService.inviteResponse(message.from_user_id, message.to_user_id, inviteId, response);
  }

  /**
   * Send event for muting user
   * @param {string} userId User id who muting
   * @param {string} socketId Id of connection of the muting user
   * @param {string} muteUserId User who will be muted
   * @returns {void}
   */
  async muteForAll(userId, socketId, muteUserId) {
    const {
      connectionService,
      apiEventService
    } = this.server.services();

    const initiatorUserConn = await connectionService.getConnection(socketId);

    if (!initiatorUserConn) {
      throw new Error('ConnectionNotFound');
    }

    if (!initiatorUserConn.channelId) {
      throw new Error('NotInChannel');
    }

    // get all user connections
    // and find connection which is in the channel
    const mutedUserConn = (await connectionService.getAllUserConnections(muteUserId))
      .find(connections => connections.channelId === initiatorUserConn.channelId);

    if (!mutedUserConn) {
      throw new Error('NotInChannel');
    }

    apiEventService.mutedForAll(userId, muteUserId, mutedUserConn.connectionId);
  }
};
