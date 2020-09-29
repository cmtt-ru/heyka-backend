import Vue from 'vue';
import VueRouter from 'vue-router';

const Landing = () => import(/* webpackChunkName: "main" */ '../views/Landing.vue');

const Auth = () => import(/* webpackChunkName: "main" */ '../views/Auth/Auth.vue');
const SignIn = () => import(/* webpackChunkName: "main" */ '../views/Auth/SignIn.vue');
const Reset = () => import(/* webpackChunkName: "main" */ '../views/Auth/Reset.vue');
const Register = () => import(/* webpackChunkName: "main" */ '../views/Auth/Register.vue');
const RegSuccess = () => import(/* webpackChunkName: "main" */ '../views/Auth/RegSuccess.vue');
const VerifyEmail = () => import(/* webpackChunkName: "main" */ '../views/Auth/Verify.vue');

const SocialLogin = () => import(/* webpackChunkName: "main" */ '../views/Auth/SocialLogin.vue');
const SocialCallback = () => import(/* webpackChunkName: "main" */ '../views/Auth/SocialCallback.vue');

const Guest = () => import(/* webpackChunkName: "main" */ '../views/Guest');
const GuestStart = () => import(/* webpackChunkName: "main" */ '../views/Guest/Start');
const GuestGrid = () => import(/* webpackChunkName: "main" */ '../views/Guest/Grid');
const GuestExpanded = () => import(/* webpackChunkName: "main" */ '../views/Guest/Expanded');
const GuestFinish = () => import(/* webpackChunkName: "main" */ '../views/Guest/Finish');

const Manage = () => import(/* webpackChunkName: "main" */ '../views/Manage');
const WorkspaceEdit = () => import(/* webpackChunkName: "main" */ '../views/WorkspaceEdit');

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
        path: 'reg-success',
        name: 'regSuccess',
        component: RegSuccess,
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
   * Create & edit workspace
   */
  {
    path: '/ws',
    component: WorkspaceEdit,
    children: [
      {
        path: 'create',
        name: 'workspace-create',
        component: WorkspaceEdit,
      },
      {
        path: 'create/:code',
        name: 'workspace-create',
        component: WorkspaceEdit,
      },
      {
        path: 'edit/:id',
        name: 'workspace-edit',
        component: WorkspaceEdit,
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
