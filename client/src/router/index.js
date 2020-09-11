import Vue from 'vue';
import VueRouter from 'vue-router';
Vue.use(VueRouter);
const Landing = () => import(/* webpackChunkName: "main" */ '../views/Landing.vue');

const Auth = () => import(/* webpackChunkName: "main" */ '../views/Auth/Auth.vue');
const SignIn = () => import(/* webpackChunkName: "main" */ '../views/Auth/SignIn.vue');
const Reset = () => import(/* webpackChunkName: "main" */ '../views/Auth/Reset.vue');
const Register = () => import(/* webpackChunkName: "main" */ '../views/Auth/Register.vue');
const VerifyEmail = () => import(/* webpackChunkName: "main" */ '../views/Auth/Verify.vue');

const SocialLogin = () => import(/* webpackChunkName: "main" */ '../views/Auth/SocialLogin.vue');
const SocialCallback = () => import(/* webpackChunkName: "main" */ '../views/Auth/SocialCallback.vue');

const Guest = () => import(/* webpackChunkName: "main" */ '../views/Guest.vue');

const Manage = () => import(/* webpackChunkName: "main" */ '../views/Manage');

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
    component: Auth,
    children: [
      {
        path: '',
        name: 'signIn',
        component: SignIn,
      },
      {
        path: 'register',
        name: 'register',
        component: Register,
      },
      {
        path: 'email/verify',
        name: 'verify',
        component: VerifyEmail,
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
    component: Manage,
    name: 'manage',
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
    path: '/guest',
    name: 'guest',
    component: Guest,
  },

];

const router = new VueRouter({
  mode: 'history',
  routes,
});

export default router;
