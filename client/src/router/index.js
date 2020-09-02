import Vue from 'vue';
import VueRouter from 'vue-router';

const Landing = () => import(/* webpackChunkName: "main" */ '../views/Landing.vue');

const Auth = () => import(/* webpackChunkName: "main" */ '../views/Auth/Auth.vue');
const SignIn = () => import(/* webpackChunkName: "main" */ '../views/Auth/SignIn.vue');
const Reset = () => import(/* webpackChunkName: "main" */ '../views/Auth/Reset.vue');

const SocialLogin = () => import(/* webpackChunkName: "main" */ '../views/Auth/SocialLogin.vue');
const SocialCallback = () => import(/* webpackChunkName: "main" */ '../views/Auth/SocialCallback.vue');

const Guest = () => import(/* webpackChunkName: "main" */ '../views/Guest');
const GuestStart = () => import(/* webpackChunkName: "main" */ '../views/Guest/Start');
const GuestGrid = () => import(/* webpackChunkName: "main" */ '../views/Guest/Grid');
const GuestExpanded = () => import(/* webpackChunkName: "main" */ '../views/Guest/Expanded');
const GuestFinish = () => import(/* webpackChunkName: "main" */ '../views/Guest/Finish');

const Manage = () => import(/* webpackChunkName: "main" */ '../views/Manage');

Vue.use(VueRouter);

const routes = [
  /**
   * Static pages routes
   */
  {
    path: '/',
    name: 'landing',
    component: Landing,
  },

  /**
   * Authorization routes
   */
  {
    path: '/auth',
    name: 'auth',
    component: Auth,
    children: [
      {
        path: '',
        name: 'signIn',
        component: SignIn,
      },
      {
        path: 'social/callback',
        name: 'auth-social-callback',
        component: SocialCallback,
      },
      {
        path: 'social/:socialName/:action/',
        name: 'auth-social-login',
        component: SocialLogin,
      },
      {
        path: 'social/:socialName/:action/:code',
        name: 'auth-social-link',
        component: SocialLogin,
      },
      {
        path: 'password/reset',
        name: 'reset',
        component: Reset,
      },
    ],
  },

  /**
   * Manage workspaces
   */
  {
    path: '/manage',
    name: 'manage',
    component: Manage,
    children: [
      {
        path: ':code',
        component: Manage,
      },
    ],
  },

  /**
   * Guest routes
   */
  {
    path: '/guest/:code',
    name: 'guest',
    component: Guest,
    children: [
      {
        path: 'start',
        name: 'guest-start',
        component: GuestStart,
      },
      {
        path: 'grid',
        name: 'guest-grid',
        component: GuestGrid,
      },
      {
        path: 'expanded/:id',
        name: 'guest-expanded',
        component: GuestExpanded,
      },
      {
        path: 'finish',
        name: 'guest-finish',
        component: GuestFinish,
      },
    ],
  },

];

const router = new VueRouter({
  mode: 'history',
  routes,
});

export default router;
