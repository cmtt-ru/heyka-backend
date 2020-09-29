import localStorage from 'local-storage';

const accessor = localStorage.bind({});

/**
 * get function with default value
 * @param {string} key - key for local storage
 * @param {object} defaultvalue default value
 * @returns {object}
 */
function get(key, defaultvalue = null) {
  let item = localStorage.get(key);

  if (item === null) {
    item = defaultvalue;
  }

  return item;
}

/**
 * check if local storage has item at 'key'
 * @param {string} key - key for local storage
 * @returns {boolean}
 */
function has(key) {
  if (localStorage.get(key) === null) {
    return false;
  }

  return true;
}

accessor.get = get;
accessor.set = localStorage.set;
accessor.has = has;

export const authFileStore = accessor;
export const heykaStore = accessor;
