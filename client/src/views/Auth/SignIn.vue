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
        <div class="currently-not-needed">
          <ui-button
            :type="3"
            wide
            class="sns-button"
            @click="socialHandler('slack')"
          >
            Slack
            <svg-icon
              slot="right"
              color="var(--icon-1)"
              name="close"
              size="medium"
            />
          </ui-button>
          <ui-button
            :type="3"
            wide
            class="sns-button"
            @click="socialHandler('facebook')"
          >
            Facebook
          </ui-button>
          <ui-button
            :type="3"
            wide
            class="sns-button"
            @click="socialHandler('google')"
          >
            Google
          </ui-button>

          <div class="or-delimiter">
            <span>{{ texts.or }}</span>
          </div>
        </div>
        <ui-form
          v-show="!passReset"
          class="reset-form"
          @submit="loginHandler()"
        >
          <ui-input
            v-model="login.email"
            icon="mail"
            class="login__input"
            placeholder="example@mail.com"
            email
            required
          />
          <ui-input
            v-model="login.password"
            icon="lock"
            required
            type="password"
            class="login__input"
            placeholder="******"
          />
          <ui-button
            :type="6"
            wide
            class="login__button"
            submit
          >
            {{ texts.login }}
          </ui-button>
          <div class="info">
            <div class="info__text">
              {{ texts.forgot }}
            </div>
            <div
              class="info__link"
              @click="toggleReset"
            >
              {{ texts.reset }}
            </div>
          </div>
        </ui-form>
        <ui-form
          v-show="passReset"
          class="reset-form"
          @submit="resetHandler"
        >
          <ui-input
            v-model="login.email"
            icon="mail"
            class="login__input"
            placeholder="example@mail.com"
            email
            required
          />
          <ui-button
            :type="12"
            wide
            class="login__button"
            submit
          >
            {{ texts.reset }}
          </ui-button>
          <ui-button
            :type="10"
            wide
            class="login__button"
            @click="toggleReset"
          >
            {{ texts.cancel }}
          </ui-button>
        </ui-form>

        <div class="info">
          <div class="info__text">
            {{ texts.newMember }}
          </div>
          <router-link
            class="info__link"
            :to="{ name: 'register'}"
          >
            {{ texts.signup }}
          </router-link>
        </div>
        <br>
      </div>
    </div>
  </div>
</template>

<script>
import UiButton from '@components/UiButton';
import { UiForm, UiInput } from '@components/Form';
import { authFileStore } from '@/store/localStore';

export default {
  components: {
    UiButton,
    UiForm,
    UiInput,
  },

  data() {
    return {
      coverSrc: null,
      passReset: false,
      login: {
        email: '',
        password: '',
      },
    };
  },

  computed: {
    /**
     * Get needed texts from I18n-locale file
     * @returns {object}
     */
    texts() {
      return this.$t('login');
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

    const inviteCode = this.$route.query.invite;

    if (inviteCode) {
      authFileStore.set('inviteCode', inviteCode);
      if (authFileStore.get('accessToken')) {
        this.$API.workspace.joinByCode(inviteCode);
      }
    }
  },

  methods: {

    toggleReset() {
      this.passReset = !this.passReset;
    },

    async socialHandler(socialName) {
      const baseUrl = IS_DEV ? process.env.VUE_APP_DEV_URL : process.env.VUE_APP_PROD_URL;
      const link = `${baseUrl}/auth/social/${socialName}/login`;

      window.open(link); // TODO: can replace with window.open (see main index.js)
    },

    async loginHandler() {
      try {
        await this.$API.auth.signin({ credentials: this.login });

        if (authFileStore.get('inviteCode')) {
          this.$API.workspace.joinByCode(authFileStore.get('inviteCode'));
          authFileStore.set('inviteCode', null);
        }

        await this.$router.push({
          name: 'landing',
        });
      } catch (err) {
        console.log('ERROR:', err);
        if (err.response.data.message === 'Email or password are invalid') {
          const notification = {
            data: {
              text: 'Wrong email/password!',
            },
          };

          console.log(notification);
          await this.$store.dispatch('addNotification', notification);
        }
      }
    },

    async resetHandler() {
      try {
        await this.$API.auth.discardPass({ email: this.login.email });
      } catch (err) {
        console.log('ERROR:', err);
      }

      this.toggleReset();
      const notification = {
        data: {
          text: 'Check your email inbox!',
        },
      };

      await this.$store.dispatch('addNotification', notification);
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
    margin 6px 0

    &:first-of-type
        margin-bottom 12px

.login__button
    margin-top 12px

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
