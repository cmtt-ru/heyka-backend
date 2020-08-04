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

      const baseUrl = IS_DEV ? process.env.VUE_APP_DEV_URL : process.env.VUE_APP_PROD_URL;

      document.location.href = `${baseUrl}/signin/${this.socialName}`;
    }
  },
};
</script>

<style lang="stylus" scoped>

</style>
