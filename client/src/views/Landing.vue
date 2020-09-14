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
          target="_blank"
          :href="macLink"
          @click="startPinging"
        >macOS</a>
        <a
          class="link"
          target="_blank"
          :href="winLink"
          @click="startPinging"
        >Windows</a>
        <a
          class="link"
          target="_blank"
          :href="linuxLink"
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
const pingTime = 2000;

export default {
  name: 'Home',
  components: {

  },
  data() {
    return {
      version: '1.1.5',
      pingInterval: null,
    };
  },
  computed: {
    macLink() {
      return `https://storage.yandexcloud.net/heyka-beta-bin/download/Heyka-${this.version}.dmg`;
    },
    winLink() {
      return `https://storage.yandexcloud.net/heyka-beta-bin/download/Heyka%20Setup%20${this.version}.exe`;
    },
    linuxLink() {
      return `https://storage.yandexcloud.net/heyka-beta-bin/download/heyka_${this.version}_amd64.deb`;
    },
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
        }, pingTime);
      }
    },
    async pingLocalWebServer(authLink, port) {
      try {
        await fetch(`http://127.0.0.1:${port}/${authLink}`, { mode: 'no-cors' });

        clearInterval(this.pingInterval);
      } catch (err) {
      }
    },
  },
};
</script>

<style lang="stylus" scoped>
.wrapper
  display flex
  height 100vh
  justify-content center
  background #F1FAFF

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
