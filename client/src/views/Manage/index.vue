<template>
  <div class="layout">
    <header>
      <img
        class="logo l-ml-12"
        width="36"
        height="36"
        alt="Vue logo"
        src="@assets/logo-2.png"
      >
      <span class="title l-ml-12">
        Heyka
      </span>
    </header>

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
import Workspaces from '@components/Manage/Workspaces';
import Users from '@components/Manage/Users';

export default {

  components: {
    Workspaces,
    Users,
  },

  data() {
    return {
      workspaces: [],
      selectedWorkspace: {},
      workspaceUsers: [],
    };
  },

  computed: {
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
    async authorize() {
      if (this.authCode) {
        return this.$API.auth.signinByLink(this.authCode);
      }
    },

    async loadWorkspaces() {
      this.workspaces = await this.$API.admin.getWorkspaces();
      this.selectedWorkspace = this.workspaces[0];
    },

    async loadUsers() {
      const workspaceData = await this.$API.admin.getUsers(this.selectedWorkspace.id);

      if (workspaceData) {
        this.workspaceUsers = workspaceData.users;
      }
    },

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

  header
    position sticky
    display flex
    align-items center
    top 0
    left 0
    width 100%
    height 60px
    background #fff
    box-shadow 0 4px 8px 0 rgba(0,0,0,0.08);
    z-index 10

    .title
      font-size 24px
      font-weight 500

  .workspace-name
    font-size 32px
    font-weight 500
    line-height 44px
    margin-bottom 24px
</style>
