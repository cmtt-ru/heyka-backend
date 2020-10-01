<template>
  <div
    class="layout__wrapper"
    :style="$themes.getColors('popover')"
  >
    <janus />
    <router-view @join="joinHandler" />
  </div>
</template>

<script>
import Janus from '@components/Janus';
import mediaDevices from '@sdk/classes/mediaDevices';
import { mapState, mapGetters } from 'vuex';
import janusVideoroomWrapper from '@sdk/classes/janusVideoroomWrapper';

export default {
  components: {
    Janus,
  },

  computed: {
    ...mapState('app', {
      devices: 'devices',
      selectedDevices: 'selectedDevices',
    }),

    ...mapGetters({
      selectedChannelId: 'me/getSelectedChannelId',
      myId: 'me/getMyId',
      firstChannel: 'channels/getFirstChannel',
    }),

    ...mapState({
      janusOptions: 'janus',
    }),

    inviteToken() {
      return this.$route.params.code;
    },
  },

  async created() {
    await this.authorize();
    this.$router.replace({ name: 'guest-start' }).catch(() => {});
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
        await this.$API.channel.join(this.inviteToken, {
          name: 'Guest',
        });
        await this.$store.dispatch('initial');
        console.log('auth success');
      } catch (e) {
        this.$router.replace({ name: 'landing' }).catch(() => {});
      }
    },

    /**
     * Join to channel
     * @returns {void}
     */
    async joinToChannel() {
      if (this.firstChannel) {
        await this.$store.dispatch('selectChannel', this.firstChannel.id);
      }
    },

    /**
     * Listen for device change event
     * @returns {void}
     */
    listenDevices() {
      return new Promise((resolve, reject) => {
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

          resolve();
        });

        mediaDevices.updateDevices();
      });
    },

    /**
     * Initialize Janus Video Room Plugin
     * @returns {Promise<void>}
     */
    async initJanusVideoRoom() {
      await janusVideoroomWrapper.init();

      if (this.selectedChannelId) {
        janusVideoroomWrapper.join(this.myId, this.janusOptions);
      }
    },

    /**
     * Join to channel
     * @returns {Promise<void>}
     */
    async joinHandler() {
      await this.listenDevices();
      await this.joinToChannel();
      await this.initJanusVideoRoom();
      this.$router.replace({ name: 'grid' });
    },

  },
};
</script>

<style lang="stylus" scoped>
  .layout__wrapper
    overflow auto
    background var(--app-bg)
    width 100vw
    min-height 100vh
    color var(--text-0)

  .bottom
    position fixed
    bottom 20px
    left 50%
    margin-left -192px
</style>
