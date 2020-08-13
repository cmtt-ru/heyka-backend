<template>
  <div class="layout">
    <ui-header />

    <div class="reset">
      <div class="reset__header">
        RESET PASSWORD
      </div>
      <div class="reset__info">
        Please enter and confirm your new password below<br>to access your account
      </div>
      <ui-form @submit="submitHandler">
        <ui-input
          v-model="pass"
          class="reset__input"
          placeholder="********"
          :minlength="8"
          :maxlength="120"
        />
        <ui-input
          v-model="passVerify"
          class="reset__input"
          placeholder="********"
          :backend-error="backendError"
          :maxlength="120"
        />
        <ui-button
          :type="1"
          :wide="true"
          class="reset__submit"
          submit
        >
          RESET PASSWORD
        </ui-button>
      </ui-form>
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
      passVerify: '',
      JWT: null,
    };
  },

  computed: {
    backendError() {
      if (!this.passVerify || this.pass === this.passVerify) {
        return null;
      }

      return 'passwords do not match';
    },
  },

  async mounted() {
    if (this.$route.params.JWT) {
      this.JWT = this.$route.params.JWT;
    }
  },

  methods: {
    submitHandler() {
      console.log(this.pass, this.passVerify);
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
    font-size 30px
    margin-bottom 8px

  &__info
    font-size 16px
    margin-bottom 20px
    text-align center

  &__input
    margin 0 0 20px
    width 300px
    max-width 90vw

  &__submit
    margin-top 12px
    width 300px
    max-width 90vw
</style>
