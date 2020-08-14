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
        <a
          class="link"
          @click="startPinging"
        >macOS</a>
        <a
          class="link"
          @click="startPinging"
        >Windows</a>
        <a
          class="link"
          @click="startPinging"
        >Linux</a>
      </div>
    </div>
  </div>
</template>

<script>
import { authFileStore } from '@/store/localStore';

// eslint-disable-next-line no-magic-numbers
const PORTS = [9615, 48757, 48852, 49057, 49086];

export default {
  name: 'Home',
  components: {

  },
  data() {
    return {
      version: '1.1.2',
      pingInterval: null,
      pingTime: 2000,
    };
  },

  methods: {
    async startPinging() {
      if (authFileStore.get('accessToken')) {
        const res = await this.$API.auth.link();

        console.log(res);
        this.pingInterval = setInterval(() => {
          for (const port of PORTS) {
            this.pingLocalWebServer(res.code, port);
          }
        }, this.pingTime);
      }
    },
    async pingLocalWebServer(authLink, port) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/${authLink}`, { mode: 'no-cors' });

        console.log(res);
        clearInterval(this.pingInterval);
      } catch (err) {
        console.log('ERRRRR', err);
      }
    },
  },
};
</script>
<style lang="stylus">
html
  background #F1FAFF
</style>

<style lang="stylus" scoped>
.wrapper
  display flex
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
    cursor pointer
    display inline
</style>
