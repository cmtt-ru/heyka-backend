<template>
  <div />
</template>

<script>
import Cookies from 'js-cookie';

export default {
  computed: {
    authCode() {
      return this.$route.query.authlink;
    },
    status() {
      return this.$route.query.success;
    },
    action() {
      return Cookies.get('heyka-auth-action');
    },
  },
  async mounted() {
    console.log(this.$route);

    if (this.action === 'login') {
      document.location.href = `heyka://login/${this.authCode}`;
    }

    if (this.action === 'link') {
      Cookies.remove('heyka-access-token');
      document.location.href = 'heyka://join/111111';
    }
  },
};
</script>

<style lang="stylus" scoped>

</style>
