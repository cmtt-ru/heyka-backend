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

      return {day, total : filteredEntityList.length};
    };

    const reducer = (days, entityList) => {
      return days.reduce((acc, currentDay) => {

        const {day,total} = getTotalOfNewEntityAtDay(entityList, currentDay);

        acc[day] = total;

        return acc;
      }, {});
    };

    try {
      const groupList = await gdb.getGroupList();
      const workspaceList = await wdb.getWorkspaceList();
      const userList = await udb.getUserList();
      const channelList = await chdb.getChannelList();

      const days = getDays(afterDay, beforeDay);

      return {
        totalOfNewGroups: reducer(days, groupList),
        totalOfNewUsers: reducer(days, userList),
        totalOfNewWorkspaces: reducer(days, workspaceList),
        totalOfNewChannels: reducer(days, channelList),
      };
    } catch (e) {
      request.log(['debug-error'], 'Error on get channel members: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
