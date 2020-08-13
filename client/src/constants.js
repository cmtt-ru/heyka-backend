const IS_DEV = process.env.NODE_ENV === 'development';

// global variables
if (typeof window !== 'undefined') {
  window.IS_DEV = IS_DEV;
}
