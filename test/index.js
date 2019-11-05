const Code = require('@hapi/code')
const Lab = require('@hapi/lab')
const expect = Code.expect
const { describe,  it, before } = exports.lab = Lab.script()
const createServer = require('../server')

describe('GET /status', () => {
  let server = null

  before(async () => {
    server = await createServer()
  })

  it('returns "OK"', async () => {
    const response = await server.inject('/status')
    expect(response.statusCode).to.be.equal(200)
    expect(response.payload).to.be.equal('OK')
  })
})

