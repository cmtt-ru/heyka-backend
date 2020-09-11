<template>
  <transition name="fade">
    <div
      v-show="visible"
      class="guest-start"
    >
      <h1>You’re about to join a video meeting</h1>
      <p class="l-mt-24">
        For others to see and hear you, your browser will request access to your cam and mic.
        You can still turn them back off at any time.
      </p>

      <div class="webcam l-mt-24">
        <video ref="video" />
        <div class="webcam__loader">
          <svg-icon
            name="video"
            size="small"
          />
        </div>
      </div>

      <p class="l-mt-24 l-mb-8">
        Enter your name
      </p>
      <ui-input
        v-model="userName"
        class="user-name"
        @keypress.enter.native="joinHandler"
      />

      <ui-button
        :type="1"
        class="l-mt-24"
        @click="joinHandler"
      >
        Join channel
      </ui-button>
    </div>
  </transition>
</template>

<script>
import mediaCapturer from '@classes/mediaCapturer';
import { mapState, mapGetters } from 'vuex';
import { UiInput } from '@components/Form';
import UiButton from '@components/UiButton';

let cameraStream = null;

export default {
  components: {
    UiInput,
    UiButton,
  },

  data() {
    let userName;

    try {
      userName = localStorage.getItem('heyka-guest-name');
    } catch (e) {
      console.error(e);
    }

    if (!userName) {
      userName = 'Guest';
    }

    console.log('NAME', userName);

    return {
      userName,
      visible: false,
    };
  },

  computed: {
    ...mapState('app', {
      devices: 'devices',
      selectedDevices: 'selectedDevices',
    }),

    ...mapGetters({
      selectedChannelId: 'me/getSelectedChannelId',
      myId: 'me/getMyId',
    }),

    ...mapState({
      janusOptions: 'janus',
    }),
  },

  async mounted() {
    const SHOW_TIMEOUT = 500;

    setTimeout(() => {
      this.visible = true;
    }, SHOW_TIMEOUT);

    try {
      const immediate = await mediaCapturer.requestMediaPermissions();

      if (immediate && this.userName !== 'Guest') {
        await this.joinHandler();
      } else {
        await this.startCameraPreview();
      }
    } catch (e) {
      console.error('requestMediaPermissions', e);
    }
  },

  beforeDestroy() {
    mediaCapturer.destroyStream(cameraStream);
  },

  methods: {
    async startCameraPreview() {
      cameraStream = await mediaCapturer.getCameraStream();

      this.$refs.video.srcObject = cameraStream;

      this.$refs.video.onloadedmetadata = () => {
        this.$refs.video.play();
      };
    },

    async joinHandler() {
      try {
        localStorage.setItem('heyka-guest-name', this.userName);
      } catch (e) {
        console.error(e);
      }

      await this.$API.user.editProfile({
        name: this.userName,
      });

      this.$emit('join');
    },
  },
};
</script>

<style lang="stylus" scoped>
  .guest-start
    max-width 500px
    margin 48px auto
    padding 36px 24px
    text-align center
    background var(--button-bg-5)
    border-radius 12px
    box-sizing border-box

    .webcam
      position relative
      height 0
      padding-bottom 62.5%
      border-radius 8px
      overflow hidden
      transform translate3d(0, 0, 0);

      &__loader
        position absolute
        display flex
        width 100%
        height 100%
        z-index 1
        background var(--app-bg)
        align-items center
        justify-content center
        animation svgClear 500ms ease-in-out

        svg
          width 96px
          height 96px

      video
        position absolute
        display block
        width 100%
        height 100%
        z-index 2
        object-fit cover

    .user-name
      width 50%
      margin 0 auto

      /deep/ input
        color var(--color-5) !important
        text-align center

  .fade-enter-active, .fade-leave-active {
    transition: opacity .25s;
  }
  .fade-enter, .fade-leave-to {
    opacity: 0;
  }

  @keyframes svgClear {
    0% {
      opacity: 1;
    }
    70% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }
</style>
