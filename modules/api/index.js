
const register = async function (server) {
  await server.route({
    method: 'GET',
    path: '/status',
    handler () {
      return 'OK'
    }
  })
}

exports.plugin = {
  pkg: require('./package.json'),
  register
}
