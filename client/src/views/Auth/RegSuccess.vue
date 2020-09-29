<template>
  <div class="layout">
    <ui-header />

    <div
      class="verify"
    >
      <div class="verify__header">
        {{ texts.header }}
      </div>

      <div class="verify__info">
        {{ texts.disclaimer }}
      </div>
    </div>
  </div>
</template>

<script>
import UiHeader from '@/components/UiHeader';

export default {
  components: {
    UiHeader,
  },

  computed: {

    /**
     * Get needed texts from I18n-locale file
     * @returns {object}
     */
    texts() {
      return this.$t('regSuccess');
    },
  },

};
</script>

<style lang="stylus" scoped>

.verify
  padding 12px
  width 500px
  max-width 90vw
  margin 10px auto 12px
  box-sizing border-box
  display flex
  flex-direction column
  align-items center
  justify-content flex-start

  &__header
    font-size 25px
    margin 24px 0
    text-transform uppercase

  &__info
    margin-bottom 20px
    text-align center
</style>
