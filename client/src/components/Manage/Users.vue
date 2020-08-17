<template>
  <div class="users">
    <div
      v-for="user in sortedUsers"
      :key="user.id"
      class="user"
    >
      <img
        class="user__avatar"
        loading="lazy"
        :src="avatarUrl(user, 32)"
        width="32"
        height="32"
      >
      <div class="user__name">
        {{ user.name }}
      </div>

      <div class="user__date">
        {{ dateFormat(user.latestActivityAt) }}
      </div>

      <div
        class="user__delete"
        @click="revokeHandler(user)"
      >
        Revoke
      </div>
    </div>
  </div>
</template>

<script>
import cloneDeep from 'clone-deep';
import dateFormat from 'dateformat';
import { getUserAvatarUrl } from '@libs/image';

export default {
  props: {
    /**
     * Array of workspace
     */
    users: {
      type: Array,
      default: function () {
        return [];
      },
    },

    /**
     * Workspace
     */
    workspace: {
      type: Object,
      default: function () {
        return {};
      },
    },
  },

  computed: {
    /**
     * Sort users alphabetically
     * @returns {array}
     */
    sortedUsers() {
      return cloneDeep(this.users).sort(function (a, b) {
        if (a.name < b.name) {
          return -1;
        }
        if (a.name > b.name) {
          return 1;
        }

        return 0;
      });
    },
  },

  methods: {
    /**
     * Revoke user's session
     * @param {object} user – user
     * @returns {Promise<void>}
     */
    async revokeHandler(user) {
      const state = confirm(`Are you sure want to revoke access for "${user.name}"?`);

      if (state) {
        try {
          await this.$API.admin.revokeAccess({
            workspaceId: this.workspace.id,
            userId: user.id,
          });

          this.$emit('update');
        } catch (e) {
          console.log('ERROR');
          console.log(e);
        }
      }
    },

    /**
     * Format date
     * @param {string} date – date
     * @returns {string}
     */
    dateFormat(date) {
      return dateFormat(new Date(date), 'dd.mm.yy HH:MM:ss');
    },

    /**
     * Avatar url
     */
    avatarUrl: getUserAvatarUrl,
  },
};
</script>

<style scoped lang="stylus">
  .users
    .user
      display flex
      align-items center
      margin 8px 0
      padding 4px 12px 4px 4px
      border-radius 2px
      cursor default

      &__avatar
        border-radius 100%
        object-fit cover
        margin-right 12px
        min-width 32px

      &__name
        font-size 18px
        line-height 1

      &__date
        margin-left auto
        margin-right 12px

      &__delete
        color lightcoral
        cursor pointer

      &:hover
        background #eee
</style>
