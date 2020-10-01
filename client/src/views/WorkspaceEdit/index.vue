<template>
  <div class="layout">
    <ui-header />

    <!-- Create state -->
    <div
      v-if="!finish"
      class="layout__wrapper layout__wrapper--create"
    >
      <h1>{{ texts.title }}</h1>

      <div class="form l-mt-24">
        <ui-image
          :image="avatar"
          :size="76"
          @input="setNewAvatar"
        />

        <ui-input
          v-model="name"
          class="l-ml-24"
          :placeholder="texts.namePlaceHolder"
        />
      </div>

      <ui-button
        :type="6"
        wide
        class="l-mt-24"
        @click="createHandler"
      >
        {{ texts.createButton }}
      </ui-button>
    </div>

    <!-- Finish state -->
    <div
      v-if="finish"
      class="layout__wrapper layout__wrapper--finish"
    >
      <h1>{{ name }} {{ texts.finish }}</h1>

      <ui-button
        :type="1"
        class="l-mt-24"
        @click="openAppHandler"
      >
        {{ texts.openApp }}
      </ui-button>

      <div class="link-wrapper l-ml-8">
        <ui-button
          v-show="!linkCopied"
          :type="1"
          class="link"
          wide
          @click="copyLinkHandler"
        >
          {{ texts.copy }}
        </ui-button>

        <ui-button
          v-show="linkCopied"
          :type="5"
          class="link"
          wide
          @click="copyLinkHandler"
        >
          {{ texts.copied }}
        </ui-button>
      </div>
    </div>
  </div>
</template>

<script>
import UiHeader from '@components/UiHeader';
import UiButton from '@components/UiButton';
import { UiInput, UiImage } from '@components/Form';

export default {
  components: {
    UiHeader,
    UiButton,
    UiInput,
    UiImage,
  },

  data() {
    return {
      name: '',
      avatar: '',
      finish: false,
      linkCopied: false,
      newWorkspace: null,
    };
  },

  computed: {
    /**
     * Auth code from route
     * @returns {string}
     */
    authCode() {
      return this.$route.params.code;
    },

    /**
     * Get needed texts from I18n-locale file
     * @returns {object}
     */
    texts() {
      return this.$t('workspace.create');
    },
  },

  async mounted() {
    await this.authorize();
  },

  methods: {
    /**
     * Authorization
     * @returns {Promise<date>}
     */
    async authorize() {
      if (this.authCode) {
        await this.$API.auth.signinByLink(this.authCode);
        await this.$router.replace('/ws/create');
      }
    },

    /**
     * Update avatar with mew image file id
     * @param {string} fileId - new image file id from uploader
     * @returns {void}
     */
    setNewAvatar(fileId) {
      this.avatar = fileId;
    },

    /**
     * Create workspace handler
     * @returns {Promise<void>}
     */
    async createHandler() {
      if (!this.name || !this.avatar) {
        const notification = {
          data: {
            text: 'Some fields are empty',
          },
        };

        await this.$store.dispatch('app/addNotification', notification);

        return;
      }

      try {
        const { workspace } = await this.$API.workspace.create({
          avatarFileId: this.avatar,
          name: this.name,
        });

        this.newWorkspace = workspace;

        this.finish = true;
      } catch (e) {
        console.error(e);
      }
    },

    /**
     * Open Heyka with specific workspace
     * @returns {void}
     */
    openAppHandler() {
      const deepLink = `heyka://workspace/${this.newWorkspace.id}`;

      window.open(deepLink);
    },

    /**
     * Copy invite link handler
     * @returns {Promise<void>}
     */
    async copyLinkHandler() {
      try {
        const codeData = await this.$API.workspace.inviteByCode(this.newWorkspace.id);

        const baseUrl = IS_DEV ? process.env.VUE_APP_DEV_URL : process.env.VUE_APP_PROD_URL;
        const link = `${baseUrl}/auth?invite=${codeData.code}`;

        navigator.clipboard.writeText(link);
        this.linkCopied = true;
      } catch (err) {
        console.error(err);
      }
    },
  },
};
</script>

<style lang="stylus" scoped>
  .layout
    display flex
    flex-direction column
    width 100%
    min-height 100vh

    &__wrapper
      max-width 600px
      margin 40px auto

      .form
        display flex
        align-items center

      .link-wrapper
        display inline-block
        width 122px
</style>
