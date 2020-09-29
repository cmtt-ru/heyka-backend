import localStorage from 'local-storage';

const accessor = localStorage.bind({});

function get(key, defaultvalue = null) {
  let item = localStorage.get(key);

  if (item === null) {
    item = defaultvalue;
  }

  return item;
}

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
