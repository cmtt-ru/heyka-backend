<template>
  <transition name="fade">
    <div
      v-show="visible"
      class="guest-finish"
    >
      <div class="guest-finish__container">
        <h1>You’ve left the room</h1>

        <p class="l-mt-24">
          Rate the connection quality
        </p>

        <div class="rating l-mt-8">
          <span
            v-for="i in [1,2,3,4,5]"
            :key="i"
            :class="{'active': i > rating}"
            @mouseenter="ratingStartHandler(i)"
          >★</span>
        </div>
      </div>
    </div>
  </transition>
</template>

<script>

export default {
  data() {
    return {
      visible: false,
      rating: 3,
    };
  },

  async mounted() {
    this.$nextTick(() => {
      this.visible = true;
    });
  },

  methods: {
    ratingStartHandler(i) {
      this.rating = i;
    },
  },
};
</script>

<style lang="stylus" scoped>
  .guest-finish
    display flex
    justify-content center
    align-items center
    height 100vh

    &__container
      max-width 500px
      margin 48px auto
      padding 36px 24px
      text-align center
      background var(--button-bg-5)
      border-radius 12px
      box-sizing border-box

  .rating
    font-size 32px
    cursor pointer
    user-select none

    span
      margin 0 2px
      transition color 70ms

      &.active
        color #353535

  .fade-enter-active, .fade-leave-active {
    transition: opacity .25s;
  }
  .fade-enter, .fade-leave-to {
    opacity: 0;
  }
</style>
