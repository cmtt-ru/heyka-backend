import Vue from 'vue';
import VueRouter from 'vue-router';
const Landing = () => import(/* webpackChunkName: "main" */ '../views/Landing.vue');

const Auth = () => import(/* webpackChunkName: "main" */ '../views/Auth.vue');
const SocialLogin = () => import(/* webpackChunkName: "main" */ '../views/Auth/SocialLogin.vue');
const SocialCallback = () => import(/* webpackChunkName: "main" */ '../views/Auth/SocialCallback.vue');

const Guest = () => import(/* webpackChunkName: "main" */ '../views/Guest.vue');

const ManageLayout = () => import(/* webpackChunkName: "main" */ '../views/Manage');
const Manage = () => import(/* webpackChunkName: "main" */ '../views/Manage/Manage');

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
        path: 'manage',
        name: 'manage',
        component: ManageLayout,
        children: [
          {
            path: '',
            name: 'manage',
            component: Manage,
          },
        ],
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
