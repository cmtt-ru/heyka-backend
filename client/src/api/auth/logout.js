import { clearTokens } from '../tokens';
import router from '@/router';

/**
 * Logic for logging out: delete tokens, destroy sockets
 * @param {object} redirectToAuth - if we shoud also redirect to auth page
 *
 * @returns {void}
 */
export default function logout(redirectToAuth = true) {
  clearTokens();

  if (redirectToAuth) {
    router.replace({ name: 'signIn' });
  }
}
