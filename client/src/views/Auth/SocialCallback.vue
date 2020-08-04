<template>
  <div class="wrapper">
    Redirecting to App with code {{ authCode }}
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
      return this.$route.params.code;
    },
  },
  async mounted() {
    console.log(this.authCode);
  },
};
</script>

<style lang="stylus" scoped>

</style>
