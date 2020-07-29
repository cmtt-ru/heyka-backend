import Vue from 'vue';
import VueRouter from 'vue-router';
const Landing = () => import(/* webpackChunkName: "main" */ '../views/Landing.vue');

Vue.use(VueRouter);

const routes = [
  {
    path: '/',
    name: 'Landing',
    component: Landing,
  },
];

const router = new VueRouter({
  mode: 'history',
  routes,
});

export default router;
