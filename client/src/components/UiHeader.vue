<template>
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
</template>

<script>
export default {

};
</script>

<style lang="stylus" scoped>
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
</style>
