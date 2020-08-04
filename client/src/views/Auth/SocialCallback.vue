<template>
  <div class="wrapper">
    Status {{ status }}. Redirecting to App with code {{ authCode }}
  </div>
</template>

<script>
// import Cookies from 'js-cookie';

export default {
  name: 'Home',
  components: {

  },
  computed: {
    authCode() {
      return this.$route.query.authlink;
    },
    status() {
      return this.$route.query.success;
    },
  },
  async mounted() {
    console.log(this.$route);
  },
};
</script>

<style lang="stylus" scoped>

</style>
