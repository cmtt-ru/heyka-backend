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
        <a>macOS</a>
        <a
          @click="startPinging"
        >Windows</a>
        <a>Linux</a>
      </div>
    </div>
  </div>
</template>

<script>
import { authFileStore } from '@/store/localStore';

export default {
  name: 'Home',
  components: {

  },
  data() {
    return {
      version: '0.1.1',
    };
  },

  methods: {
    async startPinging() {
      if (authFileStore.get('accessToken')) {
        const res = await this.$API.auth.link();

        console.log(res);
        this.pingLocalWebServer(res.data.code);
        // await fetch('http://127.0.0.1:9615/99999999', {mode: 'no-cors'});
      }
    },
    async pingLocalWebServer(authLink) {
      const res = await fetch(`http://127.0.0.1:9615/${authLink}`, { mode: 'no-cors' });

      console.log(res);
    },
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
