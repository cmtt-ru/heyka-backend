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
    error() {
      if (this.$route.query.error) {
        return this.$route.query.error;
      }

      return '';
    },
  },

  async mounted() {
    console.log(this.$route);

    if (this.action === 'login') {
      this.launchDeepLink(`login/${this.authCode}`);
    }

    if (this.action === 'link') {
      let deepLink = `social-link/${this.status}`;

      if (this.error) {
        deepLink += `/${encodeURIComponent(this.error)}`;
      }

      Cookies.remove('heyka-access-token');

      this.launchDeepLink(deepLink);
    }
  },

  launchDeepLink(url) {
    console.log('launchDeepLink', `heyka://${url}`);
    document.location.href = `heyka://${url}`;
  },
};
</script>

<style lang="stylus" scoped>

</style>
