import { _isObject } from './common.js';
import { Value } from './value.js';

const _extractValue = (o: unknown) => (o instanceof Value ? o.value : o);

/**
 * Won't extract the last fetch
 */
export const _set = (obj: any, path: string[], value: any): void => {
  let current = obj;
  const last = path.length - 1;
  for (let i = 0; i < last; i++) {
    const key = path[i];
    if (!(key in current)) {
      current[key] = {};
    }
    current = _extractValue(current[key]);
  }
  current[path[last]] = value;
};

/**
 * Because standard JSON cannot have `undefined`, so `undefined` means the property does not exist.
 *
 * Won't extract the last fetch
 */
export const _get = (obj: any, path: string[]): any => {
  let current = obj;
  const last = path.length - 1;
  for (let i = 0; i < last; i++) {
    const key = path[i];
    if (!_isObject(current) || !(key in current)) {
      return undefined;
    }
    current = _extractValue(current[key]);
  }
  return current[path[last]];
};

export const _has = (obj: any, path: string[]): boolean => {
  let current = obj;
  for (const key of path) {
    if (!_isObject(current) || !(key in current)) {
      return false;
    }
    current = _extractValue(current[key]);
  }
  return true;
};

export const _delete = (obj: any, path: string[]): void => {
  let current = obj;
  const last = path.length - 1;
  for (let i = 0; i < last; i++) {
    const key = path[i];
    if (!(key in current)) {
      return;
    }
    current = _extractValue(current[key]);
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
