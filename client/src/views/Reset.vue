<template>
  <div class="layout">
    <ui-header />

    <div class="layout__wrapper" />
    derp
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
    JWT() {
      return this.$route.params.JWT;
    },
  },

  async mounted() {

  },

  methods: {

  },
};
</script>

<style lang="stylus" scoped>
  .layout
    display flex
    flex-direction column
    width 100%

    &__wrapper
      max-width 700px
      box-sizing border-box
      display flex
      padding-right 12px
      flex 1 1 auto
</style>
