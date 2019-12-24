'use strict';

const Lab = require('@hapi/lab');
const { describe, it, before } = exports.lab = Lab.script();
const { expect } = require('@hapi/code'); 
const UserService = require('../../lib/services/user');
const sinon = require('sinon');
const bcrypt = require('bcrypt');

const stubServices = (serviceName, object) => ({
  server: {
    services () {
      return {
        [serviceName]: object
      };
    }
  }
});

describe('Unit tests: userService', () => {
  let userService = null;

  before(() => {
    userService = new UserService();
  });

  describe('findById', () => {
    it('should return user if he exists', async () => {
      const serviceStub = {
        findById: sinon.stub().resolves('user')
      };
      const result = await userService.findById.call(stubServices('userDatabaseService', serviceStub), 'anid');
      expect(result).equal('user');
    });
  });

  describe('findByEmail', () => {
    it('should return user if he exists', async () => {
      const serviceStub = {
        findByEmail: sinon.stub().resolves('user')
      };
      const result = await userService.findByEmail.call(stubServices('userDatabaseService', serviceStub), 'enemail');
      expect(result).equal('user');
    });
  });

  describe('findByExternalAuthenticatorId', () => {
    it('should return user if he exists', async () => {
      const serviceStub = {
        findByExternalAuthenticatorId: sinon.stub().resolves('user')
      };
      const result = await userService
        .findByExternalAuthenticatorId
        .call(stubServices('userDatabaseService', serviceStub), 'enemail');
      expect(result).equal('user');
    });
  });

  describe('signup', () => {
    it('should throws error when user is exists', async () => {
      const serviceStub = {
        findByEmail: sinon.stub().resolves('user'),
        insert: sinon.stub().resolves(true)
      };
      const user = { email: 'anemail' };
      let isExcept = false;
      try {
        await userService.signup.call(stubServices('userDatabaseService', serviceStub), user);
      } catch(e) {
        expect(e.message).includes('EmailExists');
        isExcept = true;
      }
      expect(isExcept).equals(true);
    });

    it ('should add user without password to the database and return him', async () => {
      const serviceStub = {
        findByEmail: sinon.stub().resolves(null),
        insert: sinon.stub().resolves(true)
      };
      const user = { email: 'anemail' };
      const regUser = await userService.signup.call(stubServices('userDatabaseService', serviceStub), user);
      expect(regUser).includes('id');
      expect(regUser.password_hash).undefined();
      expect(regUser.password_salt).undefined();
      expect(regUser).includes('updated_at');
      expect(regUser).includes('created_at');
    });

    it ('should add user with password hash and password salt to the database and return him', async () => {
      const serviceStub = {
        findByEmail: sinon.stub().resolves(null),
        insert: sinon.stub().resolves(true)
      };
      const user = { email: 'anemail', password: 'password' };
      const regUser = await userService.signup.call(stubServices('userDatabaseService', serviceStub), user);
      expect(regUser).includes('id');
      expect(regUser.password_hash).to.not.undefined();
      expect(regUser.password_salt).to.not.undefined();
      expect(regUser).includes('updated_at');
      expect(regUser).includes('created_at');
    });
  });

  describe('signin', () => {
    it('should throw error if user doesnt exists', async () => {
      const serviceStub = {
        findByEmail: sinon.stub().resolves(null)
      };
      const user = { email: 'anemail', password: 'apassword' };
      let isExcept = false;
      try {
        await userService.signin.call(stubServices('userDatabaseService', serviceStub), user);
      } catch(e) {
        expect(e.message).includes('UserNotFound');
        isExcept = true;
      }
      expect(isExcept).equals(true);
    });

    it('should throw error if user hasnt password', async () => {
      const serviceStub = {
        findByEmail: sinon.stub().resolves({
          id: 'id', 
          email: 'email', 
          password_hash: undefined, 
          password_salt: undefined 
        })
      };
      const user = { email: 'anemail', password: 'apassword' };
      let isExcept = false;
      try {
        await userService.signin.call(stubServices('userDatabaseService', serviceStub), user);
      } catch(e) {
        expect(e.message).includes('InvalidPassword');
        isExcept = true;
      }
      expect(isExcept).equals(true);
    });

    it('should throw error if user provided invalid password', async () => {
      const slt = await bcrypt.genSalt(4);
      const pwd = await bcrypt.hash('apassword', slt);
      const serviceStub = {
        findByEmail: sinon.stub().resolves({ id: 'id', email: 'email', password_hash: pwd, password_salt: slt })
      };
      const user = { email: 'anemail', password: 'notpassword' };
      let isExcept = false;
      try {
        await userService.signin.call(stubServices('userDatabaseService', serviceStub), user);
      } catch(e) {
        expect(e.message).includes('InvalidPassword');
        isExcept = true;
      }
      expect(isExcept).equals(true);
    });

    it('should return user from database if credentials are valid', async () => {
      const slt = await bcrypt.genSalt(4);
      const pwd = await bcrypt.hash('apassword', slt);
      const user = { id: 'id', email: 'email', password_hash: pwd, password_salt: slt };
      const serviceStub = {
        findByEmail: sinon.stub().resolves(user)
      };
      const userInfo = { email: 'anemail', password: 'apassword' };
      const signUser = await userService.signin.call(stubServices('userDatabaseService', serviceStub), userInfo);
      expect(signUser).equals(user);
    });
  });

  describe('createTokens', () => {
    it('creates tokens and insert it to the database', async () => {
      const serviceStub = {
        insertSession: sinon.stub().resolves(true)
      };
      const user = { id: 'id', email: 'email' };
      const tokens = await userService.createTokens.call({
        ...stubServices('userDatabaseService', serviceStub),
        createAccessToken: sinon.stub().resolves('access-token-uuid')
      }, user);
      expect(tokens.access).equals('access-token-uuid');
      expect(tokens.refresh).to.not.undefined();
      expect(serviceStub.insertSession.calledOnce).true();
    });
  });

  describe('findRefreshToken', () => {
    it('returns session info from the database by refreshToken', async () => {
      const session = { userId: 'id', access_token: 'at' };
      const serviceStub = {
        findSession: sinon.stub().withArgs(['token']).resolves(session)
      };
      const info = await userService.findRefreshToken.call({
        ...stubServices('userDatabaseService', serviceStub)
      }, 'token');
      expect(serviceStub.findSession.calledOnce).true();
      expect(info).equals(session);
    });
  });

  describe('deleteRefreshToken', () => {
    it('deletes token from the database', async () => {
      const session = { userId: 'id', access_token: 'at' };
      const serviceStub = {
        findSession: sinon.stub().resolves(session),
        deleteAccessToken: sinon.stub().resolves(true),
        deleteSession: sinon.stub().resolves(true)
      };
      await userService.deleteRefreshToken.call({
        ...stubServices('userDatabaseService', serviceStub)
      }, 'token');
      expect(serviceStub.findSession.calledOnceWithExactly('token')).true();
      expect(serviceStub.deleteAccessToken.calledOnceWithExactly('at')).true();
      expect(serviceStub.deleteSession.calledOnceWithExactly('token')).true();
    });
  });

  describe('createAccessToken', () => {
    it('creates access token and saves it to the Redis', async () => {
      const serviceStub = {
        insertAccessToken: sinon.stub().resolves(true)
      };
      const user = { id: 'id', email: 'email' };
      const token = await userService.createAccessToken.call({
        ...stubServices('userDatabaseService', serviceStub)
      }, user);
      expect(token).to.not.undefined();
      expect(serviceStub.insertAccessToken.calledOnce).true();
    });
  });

  describe('findAccessToken', () => {
    it('finds access token in the database and returns token info', async () => {
      const tokenInfo = { userId: 'id', expired: Date.now() };
      const serviceStub = {
        findAccessToken: sinon.stub().resolves(tokenInfo)
      };
      const token = await userService.findAccessToken.call({
        ...stubServices('userDatabaseService', serviceStub)
      }, 'token');
      expect(token).equals(tokenInfo);
      expect(serviceStub.findAccessToken.calledOnce).true();
    });
  });

  describe('deleteAccessToken', () => {
    it('deletes access token from the database', async () => {
      const serviceStub = {
        deleteAccessToken: sinon.stub().resolves(true)
      };
      await userService.deleteAccessToken.call({
        ...stubServices('userDatabaseService', serviceStub)
      }, 'token');
      expect(serviceStub.deleteAccessToken.calledOnce).true();
    });
  });

  describe('refreshToken', () => {
    it('throw exception if there is no such sessions in the database', async () => {
      const serviceStub = {
        findSession: sinon.stub().resolves(null),
        deleteAccessToken: sinon.stub().resolves(true),
        updateSession: sinon.stub().resolves(true)
      };
      let isExcept = false;
      try {
        await userService.refreshToken.call({
          ...stubServices('userDatabaseService', serviceStub),
          createAccessToken: sinon.stub().resolves('uuid')
        }, 'rtoken', 'atoken');
      } catch(e) {
        expect(e.message).includes('TokenNotFound');
        isExcept = true;
      }
      expect(isExcept).true();
    });

    it('throw exception if refresh token is expired', async () => {
      const refreshToken = { expired_at: Date.now() - 2000, access_token: 'atoken' };
      const serviceStub = {
        findSession: sinon.stub().resolves(refreshToken),
        deleteAccessToken: sinon.stub().resolves(true),
        updateSession: sinon.stub().resolves(true),
      };
      let isExcept = false;
      try {
        await userService.refreshToken.call({
          ...stubServices('userDatabaseService', serviceStub),
          createAccessToken: sinon.stub().resolves('uuid')
        }, 'atoken', 'rtoken');
      } catch(e) {
        expect(e.message).includes('RefreshTokenExpired');
        isExcept = true;
      }
      expect(isExcept).true();
    });

    it('throw exception if access tokens are not matched', async () => {
      const refreshToken = { expired_at: Date.now() - 2000, access_token: 'NOT(atoken)' };
      const serviceStub = {
        findSession: sinon.stub().resolves(refreshToken),
        deleteAccessToken: sinon.stub().resolves(true),
        updateSession: sinon.stub().resolves(true),
      };
      let isExcept = false;
      try {
        await userService.refreshToken.call({
          ...stubServices('userDatabaseService', serviceStub),
          createAccessToken: sinon.stub().resolves('uuid')
        }, 'atoken', 'rtoken');
      } catch(e) {
        expect(e.message).includes('AccessTokenNotMatched');
        isExcept = true;
      }
      expect(isExcept).true();
    });
    
    it('should refresh token, deletes old and creates ones', async () => {
      const refreshToken = { 
        id: 'rtokenUUID', 
        expired_at: Date.now() + 2000, 
        access_token: 'atoken', 
        user_id: 'userUUID' 
      };
      const user = { id: 'userUUID' };
      const serviceStub = {
        findSession: sinon.stub().resolves(refreshToken),
        deleteAccessToken: sinon.stub().resolves(true),
        updateSession: sinon.stub().resolves(true),
        findById: sinon.stub().resolves(user)
      };
      const tokens = await userService.refreshToken.call({
        ...stubServices('userDatabaseService', serviceStub),
        createAccessToken: sinon.stub().resolves('uuid')
      }, 'atoken', 'rtoken');

      expect(tokens.access).to.not.undefined();
      expect(tokens.refresh).to.not.undefined();
      expect(serviceStub.findSession.calledOnceWithExactly('rtoken')).true();
      expect(serviceStub.deleteAccessToken.calledOnceWithExactly('atoken')).true();
      expect(serviceStub.updateSession.firstCall.args[0]).equals(refreshToken.id);
      expect(serviceStub.findById.calledOnceWithExactly('userUUID')).true();
    });
  });
});
