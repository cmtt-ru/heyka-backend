'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');
const errorMessages = require('../../error_messages');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/statistics/daily',
  options: {
    tags: ['api', 'dashboard'],
    description: 'Get daily total number of workspaces, users, calls, groups',
    validate: {
      query: Joi.object({
        afterDay: Joi.date().optional(),
        beforeDay: Joi.date().optional(),
      }),
    },
    response: {
      status: {
        200: Joi.object({
          totalOfNewGroups: Joi.any(),
          totalOfNewUsers: Joi.any(),
          totalOfNewWorkspaces: Joi.any(),
          totalOfNewChannels: Joi.any(),
        }).label('Daily statistics details'),
        403: Joi.any().example(Boom.forbidden(errorMessages.accessDenied).output.payload)
          .description('User hasn\'t access to the channel')
      },
      failAction: 'error',
    }
  },
  handler: async (request, h) => {
    const {
      groupDatabaseService: gdb,
      workspaceDatabaseService: wdb,
      userDatabaseService: udb,
      channelDatabaseService: chdb,
    } = request.services();

    const afterDay = request.query.afterDay || '2021-06-01';
    const beforeDay = request.query.beforeDay || new Date();

    const getDays = (afterDay, beforeDay) => {
      const days = [];
      const oneDayInMs = 86400000;

      const beforeDayInMs = Date.parse(beforeDay);
      const afterDayInMs = Date.parse(afterDay);

      if (afterDayInMs < beforeDayInMs) {
        for (let i = afterDayInMs; i <= beforeDayInMs; i += oneDayInMs) {
          days.push(new Date(i));
        }
      } else {
        for (let i = beforeDayInMs; i <= afterDayInMs; i += oneDayInMs) {
          days.push(new Date(i));
        }
      }

      return days;
    };

    const getTotalOfNewEntityAtDay = (entityList, day) => {

      const oneDayInMs = 86400000;
      const startDayInMs = Date.parse(day);
      const endDayInMs = startDayInMs + oneDayInMs;

      const filteredEntityList = entityList.filter((entity) => {

        const createdAtInMs = Date.parse(entity.created_at);

        if (createdAtInMs >= startDayInMs && createdAtInMs <= endDayInMs) {
          return true;
        } else {
          return false;
        }
      });

      return {[day]: filteredEntityList.length};
    };

    const reducer = (days) => {
      return days.reduce((acc, obj) => {

        const date = Object.keys(obj)[0];
        const count = Object.values(obj)[0];

        acc[date] = count;

        return acc;
      }, {});
    };

    try {
      const groupList = await gdb.getGroupList();
      const workspaceList = await wdb.getWorkspaceList();
      const userList = await udb.getUserList();
      const channelList = await chdb.getChannelList();

      const days = getDays(afterDay, beforeDay);

      const mappedDaysByGroup = days.map((day) => {

        return getTotalOfNewEntityAtDay(groupList, day);
      });

      const mappedDaysByUser = days.map((day) => {

        return getTotalOfNewEntityAtDay(userList, day);
      });

      const mappedDaysByWorkspace = days.map((day) => {

        return getTotalOfNewEntityAtDay(workspaceList, day);
      });

      const mappedDaysByChannel = days.map((day) => {

        return getTotalOfNewEntityAtDay(channelList, day);
      });

      return {
        totalOfNewGroups: reducer(mappedDaysByGroup),
        totalOfNewUsers: reducer(mappedDaysByUser),
        totalOfNewWorkspaces: reducer(mappedDaysByWorkspace),
        totalOfNewChannels: reducer(mappedDaysByChannel),
      };
    } catch (e) {
      request.log(['debug-error'], 'Error on get channel members: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
