<template>
  <div class="layout">
    <ui-header />

    <div
      v-if="!success"
      class="reset"
    >
      <div class="reset__header">
        {{ texts.header }}
      </div>
      <div class="reset__info">
        {{ texts.disclaimer }}
      </div>
      <ui-form
        class="reset__form"
        @submit="submitHandler"
      >
        <ui-input
          v-model="pass"
          class="reset__input"
          placeholder="********"
          type="password"
          required
          :minlength="8"
          :maxlength="120"
        />
        <ui-button
          :type="1"
          class="reset__submit"
          submit
        >
          {{ texts.button }}
        </ui-button>
      </ui-form>
    </div>
    <div
      v-if="success"
      class="reset"
    >
      <div class="reset__header">
        {{ texts.saved }}
      </div>
      <a
        :href="deepLink"
        class="reset__form"
      >
        <ui-button
          :type="1"
          class=""
          submit
        >
          {{ texts.openApp }}
        </ui-button>
      </a>
      <router-link
        :to="{ name: 'landing'}"
        class="reset__landing"
        target="_blank"
      >
        {{ texts.download }}
      </router-link>
    </div>
  </div>
</template>

<script>
import UiButton from '@components/UiButton';
import UiHeader from '@components/UiHeader';
import { UiInput, UiForm } from '@components/Form';

export default {
  components: {
    UiButton,
    UiHeader,
    UiInput,
    UiForm,
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
      return this.$t('reset');
    },
  },

  async mounted() {
    this.JWT = this.$route.query.token;
    const res = await this.$API.auth.checkWebToken(this.JWT);

    if (res.result === false) {
      this.$router.push({ name: 'signIn' });
    }
  },

  methods: {
    async submitHandler() {
      try {
        const res = await this.$API.auth.resetPass({
          token: this.JWT,
          password: this.pass,
        });

        this.authlink = res.code;
        // await this.$API.auth.signinByLink(res.code);
      } catch (e) {
        console.log('ERROR on pass reset:', e);
      }
      this.success = true;
    },
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

.reset
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
    margin 24px 0 8px
    text-transform uppercase

  &__info
    margin-bottom 20px
    text-align center

  &__form
    display flex
    flex-direction row
    align-items flex-start

  &__input
    margin-right 8px
    flex-shrink 2

  &__submit
    flex-shrink 1

  &__landing
    margin-top 20px
    color var(--text-tech-2)
</style>
