<template>
  <div />
</template>

<script>
import Cookies from 'js-cookie';

export default {
  computed: {
    /**
     * Social network name
     * @returns {string}
     */
    socialName() {
      return this.$route.params.socialName;
    },

    /**
     * Authentication code
     * @returns {string | (string | null)[]}
     */
    authCode() {
      return this.$route.params.code;
    },

    /**
     * Action like a login or social-link
     * @returns {string}
     */
    action() {
      return this.$route.params.action;
    },
  },
  async mounted() {
    /** Set action cookie */
    Cookies.set('heyka-auth-action', this.action);

    /** User goes to link social network to his account */
    if (this.action === 'link') {
      const res = await this.$API.auth.signinByLink(this.authCode);

      if (res.data && res.data.accessToken) {
        Cookies.set('heyka-access-token', res.data.accessToken);
      }
    }

    /** Redirect to social login page */
    document.location.href = `/signin/${this.socialName}`;
  },
};
</script>

<style lang="stylus" scoped>

</style>
