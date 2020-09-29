<template>
  <div class="layout">
    <ui-header />

    <div class="layout__wrapper">
      <div class="layout__col layout__col--workspaces">
        <workspaces
          :selected-workspace="selectedWorkspace"
          :workspaces="workspaces"
          @select="workspaceSelectHandler"
        />
      </div>

      <div class="layout__col layout__col--content">
        <p class="workspace-name">
          {{ selectedWorkspace.name }}
        </p>

        <users
          :workspace="selectedWorkspace"
          :users="workspaceUsers"
          @update="loadUsers"
        />
      </div>
    </div>
  </div>
</template>

<script>
import Workspaces from '@/components/Manage/Workspaces';
import Users from '@/components/Manage/Users';
import UiHeader from '@/components/UiHeader';

export default {
  components: {
    Workspaces,
    Users,
    UiHeader,
  },

  data() {
    return {
      workspaces: [],
      selectedWorkspace: {},
      workspaceUsers: [],
    };
  },

  computed: {
    /**
     * Auth code from route
     * @returns {string}
     */
    authCode() {
      return this.$route.params.code;
    },
  },

  async mounted() {
    await this.authorize();
    await this.loadWorkspaces();
    await this.loadUsers();
  },

  methods: {
    /**
     * Authorization
     * @returns {Promise<date>}
     */
    async authorize() {
      if (this.authCode) {
        await this.$API.auth.signinByLink(this.authCode);
        await this.$router.replace({ name: 'manage' });
      }
    },

    /**
     * Load workspace list to which you have access
     * @returns {Promise<void>}
     */
    async loadWorkspaces() {
      this.workspaces = await this.$API.admin.getWorkspaces();
      this.selectedWorkspace = this.workspaces[0];
    },

    /**
     * Load users for selected workspace
     * @returns {Promise<void>}
     */
    async loadUsers() {
      const workspaceData = await this.$API.admin.getUsers(this.selectedWorkspace.id);

      if (workspaceData) {
        this.workspaceUsers = workspaceData.users;
      }
    },

    /**
     * Workspace select handler
     * @param {object} workspace – specific workspace object
     * @returns {Promise<void>}
     */
    async workspaceSelectHandler(workspace) {
      this.selectedWorkspace = workspace;

      await this.loadUsers();
    },
  },
};
</script>

<style lang="stylus" scoped>
  .layout
    display flex
    flex-direction column
    width 100%
    min-height 100vh

    &__wrapper
      max-width 700px
      box-sizing border-box
      display flex
      padding-right 12px
      flex 1 1 auto

    &__col
      &--workspaces
        flex 0 0 60px
        background #59a748
        padding-top 24px

      &--content
        flex 1 1 auto
        border-left 1px solid rgba(0,0,0,0.1)
        padding-left 18px
        padding-top 24px

  .workspace-name
    font-size 32px
    font-weight 500
    line-height 44px
    margin-bottom 24px
</style>
