'use strict';

exports.withTimestamp = (object, timestamp) => ({
  ...object,
  updated_at: timestamp,
  created_at: timestamp
});
