<template>
  <div class="wrapper">
    Status {{ status }}. Redirecting to App with code {{ authCode }}
  </div>
</template>

<script>
import Cookies from 'js-cookie';

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
    Cookies.remove('heyka-access-token');
    console.log(this.$route);
    document.location.href = 'heyka://join/1234';
  },
};
</script>

<style lang="stylus" scoped>

</style>
