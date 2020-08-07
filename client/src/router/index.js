import Vue from 'vue';
import VueRouter from 'vue-router';
const Landing = () => import(/* webpackChunkName: "main" */ '../views/Landing.vue');

const Auth = () => import(/* webpackChunkName: "main" */ '../views/Auth.vue');
const SignIn = () => import(/* webpackChunkName: "main" */ '../views/SignIn.vue');

const SocialLogin = () => import(/* webpackChunkName: "main" */ '../views/Auth/SocialLogin.vue');
const SocialCallback = () => import(/* webpackChunkName: "main" */ '../views/Auth/SocialCallback.vue');

const Guest = () => import(/* webpackChunkName: "main" */ '../views/Guest.vue');

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
