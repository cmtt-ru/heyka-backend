<template>
  <div class="wrapper">
    <janus />
    Guest grid
  </div>
</template>

<script>
import Janus from '@components/Janus';

const AUTH_CODE = 'be0022025d014923a114ffcaee138b772162c39cfb959d061cf8d2c3eb395ae1e49ea3c2a12576d57b';
const CHANNEL_ID = '3e6e738c-0317-4037-baf6-0eb8207a5939';

export default {
  name: 'Home',
  components: {
    Janus,
  },

  async mounted() {
    await this.authorize();

    await this.joinToChannel();
  },

  methods: {
    async authorize() {
      try {
        await this.$API.auth.signinByLink(AUTH_CODE);
        await this.$store.dispatch('initial');
        console.log('auth success');
      } catch (e) {
        console.error(e);
      }
    },

    async joinToChannel() {
      await this.$store.dispatch('selectChannel', CHANNEL_ID);
    },
  },
};
</script>

<style lang="stylus" scoped>
  body
    background #000
    color #eee
</style>
