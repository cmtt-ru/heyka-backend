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

        <img
          class="logo"
          width="36"
          height="36"
          alt="Vue logo"
          src="@assets/logo-2.png"
        >

        <img
          class="logo"
          width="36"
          height="36"
          alt="Vue logo"
          src="@assets/logo-2.png"
        >

      </div>

      <div class="layout__col layout__col--content">
        <p v-for="a in new Array(parseInt(1000))" :key="a">sdf</p>
      </div>
    </div>
  </div>
</template>

<script>

export default {
  computed: {

  },

  async mounted() {
    const workspaces = await this.$API.workspace.getWorkspaces();

    console.log(workspaces);
  },

  methods: {

  },
};
</script>

<style lang="stylus" scoped>
  .layout
    width 100%
    min-height 100vh

    &__wrapper
      max-width 700px
      margin 24px auto
      box-sizing border-box
      display flex

    &__col
      &--workspaces
        position sticky
        top 84px
        flex 0 0 60px
        align-self flex-start

      &--content
        flex 1 1 auto
        border-left 1px solid rgba(0,0,0,0.1)
        padding-left 12px

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

    .title
      font-size 24px
      font-weight 500
</style>
