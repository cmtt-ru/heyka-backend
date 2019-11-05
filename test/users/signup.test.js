// 'use strict';

// const Lab = require('@hapi/lab');
// const { describe, it, before, beforeEach } = exports.lab = Lab.script();
// const createServer = require('../../server');
// const { expect } = require('@hapi/code');

// describe('Test sandbox routes', () => {
//   console.log('2')
//   before(async ({ context }) => {
//     console.log(7)
//     context.server = await createServer()
//     console.log(8)
//   })
//   beforeEach(async ({ context }) => {
//     console.log('6')
//     await context.server.redis.client.flushdb()
//     console.log(9)
//   })
//   describe('POST /signup', () => {
//     console.log(5)
//     describe('sign up with an existed email', () => {
//       console.log(4)
//       it('returns 401', async ({ context }) => {
//         console.log(3)
//         const { server } = context;
//         const userPayload = { email: 'admin@example.com', password: 'qwerty' };
//         await server.services().userService.signup(userPayload);
//         const response = await server.inject({
//           method: 'POST',
//           path: '/signup',
//           payload: userPayload
//         });
//         expect(response.statusCode).to.be.equal(401);
//       });
//     });
//   });
// });  
