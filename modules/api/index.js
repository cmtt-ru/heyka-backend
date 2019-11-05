
const register = async function (server) {
  await server.route({
    method: 'GET',
    path: '/status',
    handler () {
      return 'OK'
    },
    options: {
      auth: false
    }
  })

  await server.route({
    method: 'GET',
    path: '/protected',
    handler () {
      return 'OK'
    }
  })

  server.auth.default('simple')
}

exports.plugin = {
  pkg: require('./package.json'),
  register
}
