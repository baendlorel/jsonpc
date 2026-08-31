export const _set = (obj: any, path: string[], value: any): void => {
  let current = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!(key in current)) {
      current[key] = {};
    }
    current = current[key];
  }
  current[path[path.length - 1]] = value;
};

export const _get = (obj: any, path: string[]): any => {
  let current = obj;
  for (const key of path) {
    if (!(key in current)) {
      return undefined;
    }
    current = current[key];
  }
  return current;
};

export const _delete = (obj: any, path: string[]): void => {
  let current = obj;
  const last = path.length - 1;
  for (let i = 0; i < last; i++) {
    const key = path[i];
    if (!(key in current)) {
      return;
    }
    current = current[key];
  }

  if (current) {
    delete current[path[last]];
  }
};

export const _move = (obj: any, from: any[], to: any[]) => {
  _set(obj, to, _get(obj, from));
  _delete(obj, from);
};

export const _exchange = (obj: any, path1: any[], path2: any[]) => {
  const value1 = _get(obj, path1);
  const value2 = _get(obj, path2);
  _set(obj, path1, value2);
  _set(obj, path2, value1);
};

export type CommentMap = Map<string, string[]>;

/**
 * Use Unit Separator, `U+001F` to join path segments into a single string key for comment storage.
 */
export const _setComment = (map: CommentMap, path: string[], comments: string[]) =>
  map.set(path.join('\x1F'), comments);

/**
 * Split a comment key back into its original path segments.
 */
export const _getComment = (map: CommentMap, path: string[]): string[] | undefined => map.get(path.join('\x1F'));
export const _deleteComment = (map: CommentMap, path: string[]) => map.delete(path.join('\x1F'));
