<template>
  <div class="layout">
    <ui-header />

    <div
      class="verify"
    >
      <div class="verify__header">
        {{ texts.header }}
      </div>

      <div class="verify__buttons-wrapper">
        <router-link
          :to="{ name: 'landing'}"
          class="verify__button"
          target="_blank"
        >
          <ui-button
            :type="1"
            class=""
            submit
          >
            {{ texts.download }}
          </ui-button>
        </router-link>

        <router-link
          :to="{ name: 'landing'}"
          class="verify__button"
          target="_blank"
        >
          <ui-button
            :type="1"
            class=""
            submit
          >
            {{ texts.createWorkspace }}
          </ui-button>
        </router-link>
      </div>

      <a
        :href="deepLink"
        class="verify__open-app"
      >
        {{ texts.openApp }}
      </a>
    </div>
  </div>
</template>

<script>
import UiButton from '@components/UiButton';
import UiHeader from '@/components/UiHeader';

export default {
  components: {
    UiButton,
    UiHeader,
  },

  data() {
    return {
      pass: '',
      JWT: null,
      success: false,
      authlink: '',
    };
  },

  computed: {

    deepLink() {
      return `heyka://login/${this.authlink}`;
    },

    /**
     * Get needed texts from I18n-locale file
     * @returns {object}
     */
    texts() {
      return this.$t('verify');
    },
  },

  async mounted() {
    this.JWT = this.$route.query.token;

    try {
      const res = await this.$API.auth.verify(this.JWT);

      console.log(res);
      const linkData = await this.$API.auth.link();

      this.authlink = linkData.code;
    } catch (err) {
      this.$router.push({ name: 'auth' });
      console.log('ERROR:', err);
    }
  },
};
</script>

<style lang="stylus" scoped>
.layout
  display flex
  flex-direction column
  width 100%

  &__wrapper
    box-sizing border-box
    display flex
    padding-right 12px
    flex 1 1 auto

.verify
  padding 012px
  width 500px
  max-width 90vw
  margin 10px auto 12px
  box-sizing border-box
  display flex
  flex-direction column
  align-items center
  justify-content flex-start

  &__header
    font-size 25px
    margin 24px 0
    text-transform uppercase

  &__buttons-wrapper
    display flex
    flex-direction row
    justify-content center

  &__button
   margin 0 12px

  &__open-app
    margin-top 20px
    color var(--text-tech-2)
</style>
