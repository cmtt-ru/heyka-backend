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

      <video
        ref="video"
        class="l-mt-24"
      />

      <p class="l-mt-24 l-mb-8">
        Enter your name
      </p>
      <ui-input v-model="userName" />

      <router-link :to="{name:'guest-grid'}">
        <ui-button
          :type="1"
          class="l-mt-24"
          @click="$emit('join')"
        >
          Join channel
        </ui-button>
      </router-link>
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
    return {
      userName: 'Guest',
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

      if (immediate && this.userName) {
        this.$emit('join');
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
  },
};
</script>

<style lang="stylus">
  .guest-start
    max-width 500px
    margin 48px auto
    padding 36px 24px
    text-align center
    background var(--button-bg-5)
    border-radius 12px
    box-sizing border-box

    video
      width 100%

  .fade-enter-active, .fade-leave-active {
    transition: opacity .25s;
  }
  .fade-enter, .fade-leave-to {
    opacity: 0;
  }
</style>
