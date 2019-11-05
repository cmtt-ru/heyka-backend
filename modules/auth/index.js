const AuthBearer = require('hapi-auth-bearer-token')
const Boom = require('@hapi/boom')

const register = async (server) => {
  await server.register(AuthBearer)

  server.auth.strategy('simple', 'bearer-access-token', {
    allowQueryToken: false,
    validate: async (request, token, h) => {
      const tokenString = await request.redis.client.get(`token:${token}`)
      if (!tokenString) {
        return { isValid: false }
      }

      try {
        const credentials = JSON.parse(tokenString)

        if (!credentials.expiredTime || Date.now() > credentials.expiredTime) {
          return Boom.unauthorized('Token is expired')
        }
        
        return {
          isValid: true,
          credentials
        }
      } catch (e) {
        request.log('error', { message: 'Error on parse token credentials', e })
        return Boom.internal()
      }
    }
  })
}

module.exports = {
  pkg: require('./package.json'),
  register
}
