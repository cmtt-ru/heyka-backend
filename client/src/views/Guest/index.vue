<template>
  <div class="wrapper">
    <janus />

    <call-buttons
      class="bottom"
      :buttons="['camera', 'screen', 'speakers', 'microphone', 'leave']"
      size="large"
    />
  </div>
</template>

<script>
import Janus from '@components/Janus';
import CallButtons from './CallButtons';
import mediaDevices from '@classes/mediaDevices';
import mediaCapturer from '@classes/mediaCapturer';
import { mapState } from 'vuex';
import getUserMedia from 'getusermedia';

const AUTH_CODE = 'be0022025d014923a114ffcaee138b772162c39cfb959d061cf8d2c3eb395ae1e49ea3c2a12576d57b';
const CHANNEL_ID = '3e6e738c-0317-4037-baf6-0eb8207a5939';

export default {
  name: 'Home',
  components: {
    Janus,
    CallButtons,
  },

  computed: {
    ...mapState('app', {
      devices: 'devices',
      selectedDevices: 'selectedDevices',
    }),
  },

  async created() {
    try {
      await this.requestMediaPermissions();
    } catch (e) {
      console.error('requestMediaPermissions', e);
    }

    this.listenDevices();
    await this.authorize();
    await this.joinToChannel();
  },

  beforeDestroy() {
    mediaDevices.removeAllListeners('change');
  },

  methods: {
    /**
     * Authorize guest
     * @returns {void}
     */
    async authorize() {
      try {
        await this.$API.auth.signinByLink(AUTH_CODE);
        await this.$store.dispatch('initial');
        console.log('auth success');
      } catch (e) {
        console.error(e);
      }
    },

    /**
     * Join to channel
     * @returns {void}
     */
    async joinToChannel() {
      await this.$store.dispatch('selectChannel', CHANNEL_ID);
    },

    /**
     * Listen for device change event
     * @returns {void}
     */
    listenDevices() {
      mediaDevices.on('change', (devices) => {
        console.log('change', devices);
        this.$store.commit('app/SET_DEVICES', devices);

        /* re-set default devices if previous id's are not found */
        const data = { ...this.selectedDevices };

        if (!this.devices.speakers.map(el => el.id).includes(this.selectedDevices.speaker)) {
          data.speaker = 'default';
        }
        if (!this.devices.microphones.map(el => el.id).includes(this.selectedDevices.microphone)) {
          data.microphone = 'default';
        }
        if (!this.devices.cameras.map(el => el.id).includes(this.selectedDevices.camera)) {
          if (this.devices.cameras[0]) {
            data.camera = this.devices.cameras[0].id;
          } else {
            data.camera = '';
          }
        }
        this.$store.dispatch('app/setSelectedDevices', data);
      });

      mediaDevices.updateDevices();
    },

    /**
     * Request camera & microphone permissions
     * @returns {void}
     */
    async requestMediaPermissions() {
      return new Promise((resolve, reject) => {
        getUserMedia(function (err, stream) {
          if (err) {
            reject(err);
          } else {
            mediaCapturer.destroyStream(stream);
            resolve(stream);
          }
        });
      });
    },

    /**
     * Get screen sharing stream
     * @returns {stream}
     */
    async getScreenStream() {
      let captureStream = null;

      try {
        captureStream = await navigator.mediaDevices.getDisplayMedia({
          audio: false,
          video: true,
        });
      } catch (err) {
        console.error('Error: ' + err);
      }

      return captureStream;
    },
  },
};
</script>

<style lang="stylus" scoped>
  .bottom
    position fixed
    bottom 20px
    left 50%
    margin-left -192px
</style>
