<template>
  <div class="guest-start">
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
        class="l-mt-12"
        submit
      >
        Join channel
      </ui-button>
    </router-link>
  </div>
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
    try {
      await mediaCapturer.requestMediaPermissions();

      await this.startCameraPreview();

      this.$emit('media-permissions', {
        state: true,
      });
    } catch (e) {
      this.$emit('media-permissions', {
        state: true,
        error: e,
      });
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
    margin 0 auto
    padding 50px 16px
    text-align center

    video
      width 100%
</style>
