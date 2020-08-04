<template>
  <div class="wrapper">
    Redirecting to {{ socialName }} with code {{ authCode }}
  </div>
</template>

<script>
import Cookies from 'js-cookie';

export default {
  name: 'Home',
  components: {

  },
  computed: {
    socialName() {
      return this.$route.params.socialName;
    },
    authCode() {
      return this.$route.params.code;
    },
  },
  async mounted() {
    const res = await this.$API.auth.signinByLink(this.authCode);

    if (res.data && res.data.accessToken) {
      Cookies.set('heyka-access-token', res.data.accessToken);

      document.location.href = `/signin/${this.socialName}`;
    }
  },
};
</script>

<style lang="stylus" scoped>

</style>
