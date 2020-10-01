<template>
  <div class="page-wrapper">
    <div class="image">
      <img
        class="sidebar-image"
        :src="coverSrc"
      >
    </div>
    <div class="page l-p-18">
      <p class="l-fs-18">
        {{ texts.welcome }}
      </p>
      <div class="page__content">
        <ui-form
          class="reset-form"
          @submit="registerHandler()"
        >
          <ui-input
            v-model="newUser.name"
            icon="user"
            class="login__input"
            :placeholder="texts.name"
            :minlength="3"
            required
          />
          <ui-input
            v-model="newUser.email"
            icon="mail"
            class="login__input"
            placeholder="example@mail.com"
            email
            required
          />
          <ui-input
            v-model="newUser.password"
            icon="lock"
            required
            :minlength="8"
            :maxlength="120"
            type="password"
            class="login__input"
            placeholder="******"
            enter-submit
          />
          <ui-button
            :type="6"
            wide
            class="login__button"
            submit
          >
            {{ texts.register }}
          </ui-button>
        </ui-form>

        <div class="info">
          <div class="info__text">
            {{ texts.oldMember }}
          </div>
          <router-link
            :to="{ name: 'auth'}"
            class="info__link"
          >
            {{ texts.login }}
          </router-link>
        </div>
        <ui-button
          :type="12"
          wide
          class="login__button--delete"
          @click="deleteHandler()"
        >
          Удалить пользователя
        </ui-button>
      </div>
    </div>
  </div>
</template>

<script>
import UiButton from '@components/UiButton';
import { UiForm, UiInput } from '@components/Form';
import { determineLocale } from '@sdk/translations/i18n';
import { authFileStore } from '@/store/localStore';
import { errorMessages } from '@api/errors/types';

export default {
  components: {
    UiButton,
    UiForm,
    UiInput,
  },

  data() {
    return {
      coverSrc: null,
      newUser: {
        name: '',
        email: '',
        password: '',
        lang: determineLocale(),
      },
    };
  },

  computed: {
    /**
     * Get needed texts from I18n-locale file
     * @returns {object}
     */
    texts() {
      return this.$t('register');
    },
  },

  mounted() {
    const hour = new Date().getHours();
    const morning = 13;
    const evening = 17;

    if (hour < morning || hour > evening) {
      this.coverSrc = require('@assets/img/cover_night.png');
    } else {
      this.coverSrc = require('@assets/img/cover_day.png');
    }
  },

  methods: {

    async socialHandler(socialName) {
      const baseUrl = IS_DEV ? process.env.VUE_APP_DEV_URL : process.env.VUE_APP_PROD_URL;
      const link = `${baseUrl}/auth/social/${socialName}/login`;

      window.open(link);
    },

    async registerHandler() {
      try {
        console.log(this.newUser);
        const res = await this.$API.auth.signup({ user: this.newUser });

        if (authFileStore.get('inviteCode')) {
          this.$API.workspace.joinByCode(authFileStore.get('inviteCode'));
          authFileStore.set('inviteCode', null);
        }

        console.log(res);

        this.$router.push({ name: 'regSuccess' });
      } catch (err) {
        if (err.response.data.message === errorMessages.emailExists) {
          const notification = {
            data: {
              text: errorMessages.emailExists,
            },
          };

          await this.$store.dispatch('app/addNotification', notification);
        }
        console.log('ERROR:', err);
      }
    },

    async deleteHandler() {
      try {
        const res = await this.$API.auth.deleteAccount({ password: this.newUser.password });

        console.log(res);
        // await this.$router.push({
        //   name: 'landing',
        // });
      } catch (err) {
        console.log('ERROR:', err);
      }
    },
  },
};
</script>

<style lang="stylus" scoped>
.currently-not-needed
  opacity 0.5
  pointer-events none
.sidebar-image
    width 100%
    height 100vh
    display block
    object-fit cover
    object-position 0 0

.page-wrapper
    height 100%
    max-width 1200px
    margin 0 auto
    box-sizing border-box
    display flex
    flex-direction row

.page
    height 100vh
    box-sizing border-box
    display flex
    flex-direction column
    justify-content center
    flex-grow 2

    &__content
        display flex
        flex-direction column
        justify-content center

.or-delimiter
    width 100%
    text-align center
    box-shadow 0 1px 0 0 var(--stroke-3)
    line-height 0.1em
    margin 20px 0 24px

    & span
        background var(--app-bg)
        padding 0 10px

.sns-button
    margin-bottom 12px

.login__input
    margin 6px 0 12px

.login__button
    margin-top 12px

    &--delete
      display none

.info
    display flex
    flex-direction row
    margin-top 24px

    &__link
        margin-left 8px
        color var(--text-tech-2)
        cursor pointer

.reset-form
  min-height 185px
  display flex
  flex-direction column
  justify-content top

@media screen and (max-width: 850px)
  .sidebar-image
    display none

</style>
