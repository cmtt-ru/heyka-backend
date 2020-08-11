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
        :src="workspace.avatar"
      >
    </div>
  </div>
</template>

<script>
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
    selectWorkspaceHandler(workspace) {
      this.$emit('select', workspace);
    },

  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="stylus">
  .workspaces

    &__item
      width 46px
      height 46px
      border 1px solid #eee
      padding 4px
      box-sizing border-box
      border-radius 4px
      cursor pointer

      &--selected
        cursor default
        border-color #30B1F2
        background alpha(#30B1F2, 0.1)

</style>
