<template>
  <div class="layout">
    <ui-header />

    <div class="layout__wrapper">
      <h1>Name your workspace</h1>

      <div class="form l-mt-24">
        <ui-image
          :image="avatar"
          :size="76"
          @input="setNewAvatar"
        />

        <ui-input
          v-model="name"
          class="l-ml-24"
          placeholder="Workspace"
        />
      </div>

      <ui-button
        :type="6"
        wide
        class="l-mt-24"
        @click="createHandler"
      >
        Create
      </ui-button>
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
        await this.$router.replace('/workspace/create');
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
        await this.$API.workspace.create({
          avatarFileId: this.avatar,
          name: this.name,
        });
      } catch (e) {
        console.error(e);
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
</style>
