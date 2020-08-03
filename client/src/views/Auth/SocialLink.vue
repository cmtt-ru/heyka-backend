<template>
  <div class="wrapper">
    Redirecting to {{ socialName }} with code {{ authCode }}
  </div>
</template>

<script>

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
    console.log('signinByLink', res);

    const res2 = await this.$API.auth.signinBySocial(this.socialName);
    console.log('signinBySocial', res2);
  },
};
</script>

<style lang="stylus" scoped>

</style>
