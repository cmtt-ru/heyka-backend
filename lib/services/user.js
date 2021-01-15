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
   * Create user by invite
   * @param {string} inviteCode Invite code
   * @param {object} userData User info
   */
  async signupByChannelInvite(inviteCode, userData) {
    const {
      inviteCodesDatabaseService: codeService,
      channelDatabaseService: chdb,
      workspaceDatabaseService: wdb,
      userDatabaseService: udb,
      workspaceService,
    } = this.server.services();
    const now = new Date();

    // Invite validation and pre checks
    const invite = await codeService.getInviteByCode(inviteCode);

    if (!invite) {
      throw new Error('InvalidCode');
    }

    if (now > new Date(invite.expired_at)) {
      throw new Error('InvalidCode');
    }

    const [
      workspace,
      channel
    ] = await Promise.all([
      wdb.getWorkspaceById(invite.workspace_id),
      chdb.getChannelById(invite.channel_id),
    ]);

    if (!workspace || !channel) {
      throw new Error(workspace ? 'ChannelNotFound' : 'WorkspaceNotFound');
    }

    if (channel.workspace_id !== workspace.id) {
      throw new Error('Channel is not owned by workspace, something went wrong');
    }

    // Prepare new temporary user
    const userInfo = helpers.withTimestamp({
      id: uuid4(),
      name: userData.name,
      invite_id: invite.id,
      is_email_verified: false,
    }, new Date());

    await udb.insert(userInfo);

    // add user to workspace as a guest
    await workspaceService.addUserToWorkspace(
      channel.workspace_id,
      userInfo.id,
      'guest',
      [ channel.id ],
      invite.id,
    );

    return userInfo;
  }

  /**
   * Signs up user
   * @param {object} userInfo Object with signup details
   * @returns {object} Ready to use user object
   */
  async signup (userInfo) {
    const {
      userDatabaseService,
      emailService,
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

    const parallelProcesses = [];

    await userDatabaseService.insert(user);

    // create email verification code and send it to email
    // if it is email-password sign up
    if (userInfo.email && !userInfo.auth) {
      const token = jwt.sign({
        userId: id,
        email: userInfo.email,
      }, `${config.jwtSecret}`, {
        expiresIn: EMAIL_VERIFICATION_CODE_LIFESPAN / 1000,
      });
      parallelProcesses.push(emailService.sendEmailVerificationCode(user,token));
    }

    await Promise.all(parallelProcesses);

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
   * Signout user sessions
   * @param {string} userId User id
   * @param {string} accessToken Access token to delete
   */
  async signout (userId, accessToken) {
    await this.cancelSession({ accessToken });
  }

  /**
   * Detach external service from the account
   * @param {string} userId User id
   * @param {(facebook|google|slack)} service External service
   */
  async detachExternalService(userId, service) {
    const {
      userDatabaseService: udb,
      apiEventService,
    } = this.server.services();

    const user = await udb.findById(userId);

    if (!user) {
      throw new Error('UserNotFound');
    }

    if (!user.auth || !user.auth[service]) {
      throw new Error('ServiceNotAttached');
    }

    const isTherePasswordAuth = user.email && user.password_hash;
    const singleExternalAccount = Object.keys(user.auth).length <= 1;
    if (!isTherePasswordAuth && singleExternalAccount) {
      throw new Error('LastLoginMethod');
    }

    delete user.auth[service];

    await udb.updateUser(userId, {
      auth: {
        ...user.auth
      }
    });

    apiEventService.meUpdated(user.id, user);
  }

  /*
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

    // sign jwt with user password hash to make
    // jwt single use
    const secret = user.password_hash || config.jwtSecret;

    const token = jwt.sign({
      userId: user.id,
      action: 'resetPassword'
    }, secret, {
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
      apiEventService,
    } = this.server.services();

    const unverifiedData = jwt.decode(token);
    let data = null;
    
    const user = await udb.findById(unverifiedData.userId);

    if (!user) {
      throw new Error('UserNotFound');
    }
    
    const secret = user.password_hash || config.jwtSecret;

    try {
      data = jwt.verify(token, secret);
    } catch(e) {
      throw new Error('TokenIsInvalid');
    }

    if (data.action !== 'resetPassword') {
      throw new Error('TokenIsInvalid');
    }


    const passwordSalt = await bcrypt.genSalt(SALT_ROUNDS);
    const passwordHash = await bcrypt.hash(password, passwordSalt);

    const updateUserData = {
      password_salt: passwordSalt,
      password_hash: passwordHash
    };

    await udb.updateUser(user.id, updateUserData);

    // logout from all users sessions
    await this.logoutFromAllSessions(user.id);

    // notify user about password changed
    apiEventService.passwordChanged(user.id);

    return user;
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

    // if it is file, check that user owns the file and it is avatar 
    if (info.avatarFileId) {
      const avatarSet = await fileService.getImageSetForOwnedEntity('avatar', userId, info.avatarFileId);
      info.avatar_set = avatarSet;
      info.avatar_file_id = info.avatarFileId;
      delete info.avatarFileId;
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
   * Update app settings for user and notify him about update
   * @param {string} userId User id
   * @param {object} appSettings App settings
   */
  async updateAppSettings(userId, appSettings) {
    const {
      userDatabaseService: udb,
      apiEventService,
    } = this.server.services();

    const user = await udb.findById(userId);
      
    if (!user) {
      throw new Error('UserNotFound');
    }
    
    user.app_settings = {
      ...user.app_settings,
      ...appSettings
    };
  
    await udb.updateUser(userId, {
      app_settings: user.app_settings,
    });

    apiEventService.meUpdated(userId, user, 'app-settings');
  
    return user;
  }

  /*
   * Delete account
   * @param {string} userId User id
   * @param {?password} password User's password
   */
  async deleteAccount(userId, password) {
    const {
      userDatabaseService: udb,
      workspaceDatabaseService: wdb,
      workspaceService,
      connectionService,
      verificationCodesDatabaseService: vcdb,
      authLinksDatabaseService: aldb,
    } = this.server.services();

    const user = await udb.findById(userId);

    if (!user) {
      throw new Error('NotFound');
    }

    // Check passwords are matched
    if (user.password_hash) {
      if (!password) {
        throw new Error('InvalidPassword');
      }

      const passMatch = await bcrypt.compare(password, user.password_hash);

      if (!passMatch) {
        throw new Error('InvalidPassword');
      }
    }

    // Admins cannot delete account
    const userWorkspaces = await wdb.getWorkspacesByUserId(user.id);
    if (userWorkspaces.find(w => w.role === 'admin')) {
      throw new Error('AdminCannotBeDeleted');
    }

    // kick user from all workspaces
    await Promise.all(
      userWorkspaces.map(
        w => workspaceService.kickUserFromWorkspace(w.id, user.id)
      ),
    );

    // disconnect user from all socket connections
    const connections = await connectionService.getAllUserConnections(user.id);
    if (connections.length) {
      connections.forEach(conn => this.server.apiEvents.emit('disconnect', conn.connectionId));
    }

    // logout from all user sessions
    await this.logoutFromAllSessions(user.id);

    // delete user from database
    // sessions, files and other records
    // should be deleted with CASCADE deleting
    await vcdb.deleteAllVerificationCodes(user.id); // there is no ON DELETE CASCADE :(
    await aldb.deleteAllLinks(user.id);
    await udb.deleteUser(user.id);
  }

  /**
   * Verify JWT and return boolean result
   * @param {string} token JWT
   */
  async validateJWT(token, secret) {
    try {
      jwt.verify(token, secret);
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

    tokenInfo.accessToken = token;
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
   * Get all user sessions and deactivate them
   * @param {string} userId User id
   */
  async logoutFromAllSessions(userId) {
    const {
      userDatabaseService: udb,
    } = this.server.services();

    const allSessions = await udb.getAllUserSessions(userId);

    await Promise.all(
      allSessions.map(
        s => Promise.all([
          udb.deleteSession(s.refresh_token),
          udb.deleteAccessToken(s.access_token),
        ]),
      ),
    );
  }

  /**
   * Cancel specific session
   * @param {object} opts Options
   * @param {?string} accessToken Find session by accessToken
   * @param {?string} sessionId Find session by sessionId
   */
  async cancelSession({ accessToken, sessionId }) {
    const {
      userDatabaseService: udb,
    } = this.server.services();

    let session = null;

    if (accessToken) {
      session = await udb.findSessionByAccessToken(accessToken);
    } else if (sessionId) {
      session = await udb.findSessionById(sessionId);
    }

    if (!session) {
      throw new Error('NotFound');
    }

    await this.deleteRefreshToken(session.refresh_token);
  }

  /**
   * Updates online status of user and notify all in workspace
   * @param {String} userId User id
   * @param {string} workspaceId Workspace id
   * @param {String} onlineStatus Online status (online, idle, offline)
   * @param {String} cause For what cause online status has been changed
   */
  async updateOnlineStatus(userId, socketId, onlineStatus, cause) {
    const {
      apiEventService,
      connectionService,
      userDatabaseService: udb,
      workspaceDatabaseService: wdb,
    } = this.server.services();
    const redlock = this.server.plugins['hapi-redlock-plugin'].redlock;

    const lock = await redlock.lock(`user-connections-${userId}`, 500);

    const conns = await connectionService.getAllUserConnections(userId);
    const connection = conns.find(c => c.connectionId === socketId);
    if (!connection) {
      throw new Error('ConnectionNotFound');
    }

    if (onlineStatus === 'online' && connection.onlineStatus === 'sleep') {
      delete connection.onlineStatus;
      await connectionService.setConnectionObject(connection);
    } else if (onlineStatus === 'idle' && cause === 'sleep') {
      connection.onlineStatus = 'sleep';
      await connectionService.setConnectionObject(connection);
    }

    const user = await udb.findById(userId);
    let newOnlineStatus = connectionService.getMaxOnlineStatus(conns, user.online_status);
    if (cause === 'manually') {
      newOnlineStatus = onlineStatus;
    }
    if (user.online_status !== newOnlineStatus) {
      await udb.updateUser(connection.userId, { online_status: newOnlineStatus });
      const workspaces = await wdb.getWorkspacesByUserId(connection.userId);
      workspaces.forEach(w => apiEventService.onlineStatusUpdated(connection.userId, w.id, newOnlineStatus));
      if (cause === 'manually') {
        apiEventService.myOnlineStatusUpdated(userId, newOnlineStatus);
      }    
    }

    await lock.unlock();
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
   * Check verification token and update user set email verified
   * @param {string} token JWT
   */
  async verifyEmailAddress(token) {
    const {
      userDatabaseService: udb,
    } = this.server.services();

    let data = null;

    try {
      data = jwt.verify(token, config.jwtSecret);
    } catch(e) {
      throw new Error('TokenIsInvalid');
    }

    const user = await udb.findById(data.userId);

    if (!user) {
      throw new Error('UserNotFound');
    }
    
    if (user.email !== data.email) {
      throw new Error('EmailNotMatched');
    }

    if (user.is_email_verified) {
      return;
    }

    // update user in the database
    await udb.updateUser(user.id, { is_email_verified: true });

    return user;
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
      // connectionService,
      apiEventService,
      workspaceService,
      permissionService,
      notificationService,
      userDatabaseService: udb,
    } = this.server.services();
    // const userConnections = await connectionService.getAllUserConnections(toUserId);

    // if (userConnections.length === 0) {
    //   throw new Error('UserNotConnected');
    // }

    // check if user has access for this channel
    const canSelectChannel = await permissionService.canSelectChannel(channelId, toUserId);
    if (!canSelectChannel) {
      await workspaceService.addMembersToChannel(channelId, workspaceId, [toUserId]);
    }

    // prevent new message if there is already message in that channel
    const alreadySentInvites = await messageDatabaseService.getChannelMessagesForUser(channelId, toUserId);

    if (alreadySentInvites.length > 0) {
      return alreadySentInvites[0].id;
    }

    const user = await udb.findById(toUserId);

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

    // Send push notifications to users
    if (user.device_tokens && user.device_tokens.length > 0) {
      const endpoints = user.platform_endpoints;
      await Promise.all(
        user.device_tokens.map(
          token => notificationService.sendPushNotificationToDevice(endpoints[token], {
            event: 'invite',
            data: {
              inviteId: messageInfo.id,
              isResponseNeeded,
              userId: fromUserId,
              workspaceId,
              channelId,
              message
            }
          }))
      );
    }
  

    if (isResponseNeeded) {
      // save message to the database
      await messageDatabaseService.addMessage(messageInfo);

      // wait some time before notify about no response
      const waitTimeout = process.env.NO_MESSAGE_RESPONSE_TIMEOUT
        ? parseInt(process.env.NO_MESSAGE_RESPONSE_TIMEOUT, 10)
        : NO_MESSAGE_RESPONSE_TIMEOUT;
      setTimeout(async () => {
        try {
          const m = await messageDatabaseService.getMessage(messageInfo.id);
          
          // if message in the database
          // notify about no response
          // and delete message 
          if (m) {
            apiEventService.noInviteResponse(fromUserId, toUserId, messageInfo.id);
            await messageDatabaseService.deleteMessage(messageInfo.id);
          }
        } catch (e) {
          console.error('Process response callback: error in timeout', e);
        }
      }, waitTimeout);
    }

    return messageInfo.id;
  }

  async cancelChannelInvitesForUser(channelId, userId) {
    const {
      messageDatabaseService: mdb,
      apiEventService,
      notificationService,
      userDatabaseService: udb,
    } = this.server.services();

    const messages = await mdb.getChannelMessagesForUser(channelId, userId);
    const user = await udb.findById(userId);

    messages.forEach(async message => {
      await mdb.deleteMessage(message.id);
      apiEventService.inviteCancelled(message.to_user_id, message.id);

      // reset push notifications
      if (user.device_tokens && user.device_tokens.length > 0) {
        const endpoints = user.platform_endpoints;
        await Promise.all(
          user.device_tokens.map(
            token => notificationService.sendPushNotificationToDevice(endpoints[token], {
              event: 'invite-cancelled',
              data: {
                inviteId: message.id,
              }
            }))
        );
      }
    });
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

  /**
   * Increase usage count of specific channel for the user
   * 
   * @param {string} userId User id 
   * @param {string} channelId Channel id
   */
  async increaseChannelUsageCount(userId, channelId) {
    const {
      channelDatabaseService: chdb,
    } = this.server.services();

    const relation = await chdb.getChannelMemberRelation(channelId, userId);
    
    if (!relation) {
      return;
    }

    await chdb.updateChannelMemberRelation(channelId, userId, {
      usage_count: relation.usage_count + 1,
      latest_usage: new Date(),
    });
  }

  /**
   * Increase count of calls between two users
   * 
   * @param {string} user1Id Initiator user id
   * @param {string} user2Id Invited user id
   * @param {string} workspaceId Workspace id
   */
  async increaseCallsCountBetweenUsers(user1Id, user2Id, workspaceId) {
    const {
      userDatabaseService: udb,
    } = this.server.services();

    const relation = await udb.getRelationBetweenUsers(user1Id, user2Id);

    if (!relation) {
      await udb.insertRelationBetweenUsers({
        user1: user1Id,
        user2: user2Id,
        workspace_id: workspaceId,
        calls_count: 1,
        latest_call: new Date(),
      });
    } else {
      await udb.updateRelationBetweenUsers(user1Id, user2Id, {
        calls_count: relation.calls_count + 1,
        latest_call: new Date(),
      });
    }
  }
};
