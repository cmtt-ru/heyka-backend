<template>
  <div class="layout">
    <ui-header />

    <div class="layout__wrapper">
      a
    </div>
  </div>
</template>

<script>
import UiHeader from '@components/UiHeader';

export default {
  components: {
    UiHeader,
  },

  data() {
    return {
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
  },

  methods: {
    /**
     * Authorization
     * @returns {Promise<date>}
     */
    async authorize() {
      if (this.authCode) {
        await this.$API.auth.signinByLink(this.authCode);
        await this.$router.replace('/workspace/create');
      }
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
