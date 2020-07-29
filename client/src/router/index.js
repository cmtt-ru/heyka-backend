import Vue from 'vue';
import VueRouter from 'vue-router';
const Landing = () => import(/* webpackChunkName: "main" */ '../views/Landing.vue');
const Auth = () => import(/* webpackChunkName: "main" */ '../views/Auth.vue');
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
