export const _isArray = Array.isArray;
export const _keys = Object.keys;

export const _noop = () => {};

export const _notComment = (t: string) => !t.startsWith(COMMENT_PREFIX);

export const _split = (path: string | string[]): string[] => {
  if (typeof path === 'string') {
    return path.split('.');
  }
  if (_isArray(path) && path.length > 0) {
    return path;
  }
  throw new TypeError(`Invalid propPath, must be string | string[].`);
};

export const _stripPrefix = (t: string) => t.replace(COMMENT_PREFIX, '').trimStart();
