<template>
  <div class="wrapper">

    <div class="content">
      <img
        width="200"
        height="200"
        alt="Vue logo"
        src="../assets/logo.png"
      >
      <p class="title">
        Heyka {{ version }}
      </p>

      <div class="download">
        <a href="">macOS</a>
        <a href="">Windows</a>
        <a href="">Linux</a>
      </div>
    </div>

  </div>
</template>

<script>

export default {
  name: 'Home',
  components: {

  },
  data() {
    return {
      version: '0.1.1',
    };
  },
};
</script>

<style lang="stylus" scoped>
  .wrapper
    display flex
    background #F1FAFF
    width 100vw
    height 100vh
    justify-content center

  .content
    max-width 700px
    text-align center
    line-height 1
    margin-top 70px

    .title
      font-size 48px
      font-weight 500
      margin-top 24px
      color #151515

  .download
    margin-top 64px

    a
      margin 0 6px
      color #777
      text-decoration none
      border-bottom 1px solid #ccc
</style>
