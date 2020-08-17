<template>
  <div class="workspaces">
    <div
      v-for="workspace in workspaces"
      :key="workspace.id"
      class="workspaces__item"
      :class="{'workspaces__item--selected': selectedWorkspace.id === workspace.id}"
      @click="selectWorkspaceHandler(workspace)"
    >
      <img
        class="logo"
        width="36"
        height="36"
        alt="Vue logo"
        :src="avatarUrl(workspace, 36)"
      >
    </div>
  </div>
</template>

<script>
import { getUserAvatarUrl } from '@libs/image';

export default {
  props: {
    /**
     * Array of workspace
     */
    workspaces: {
      type: Array,
      default: function () {
        return [];
      },
    },

    /**
     * Selected workspace
     */
    selectedWorkspace: {
      type: Object,
      default: function () {
        return {};
      },
    },
  },

  methods: {
    /**
     * Workspace selected event handler
     * @param {object} workspace – workspace
     * @returns {void}
     */
    selectWorkspaceHandler(workspace) {
      this.$emit('select', workspace);
    },

    /**
     * Avatar url
     */
    avatarUrl: getUserAvatarUrl,
  },
};
</script>

<style scoped lang="stylus">
  .workspaces
    position sticky
    top 84px
    display flex
    flex-direction column
    align-items center

    &__item
      width 46px
      height 46px
      border 1px solid rgba(255,255,255,0.4)
      padding 4px
      box-sizing border-box
      border-radius 4px
      cursor pointer
      margin-bottom 8px

      &--selected
        cursor default
        border-color #2e8014
        background rgba(255,255,255,1)

</style>
