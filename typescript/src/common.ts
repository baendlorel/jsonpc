import { ReflectDeep } from 'reflect-deep';

export const _isArray = Array.isArray;
export const _keys = Object.keys;

export function _mustArray(value: any, name: string): asserts value is any[] {
  if (!_isArray(value)) {
    throw new TypeError(`Invalid ${name}, must be an array of strings.`);
  }
}

export const { get: _get, set: _set, has: _has, deleteProperty: _delete } = ReflectDeep;

export const _move = (obj: any, from: any[], to: any[]) => {
  const value = _get(obj, from);
  _set(obj, to, value);
  _delete(obj, from);
};

export const _exchange = (obj: any, path1: any[], path2: any[]) => {
  const value1 = _get(obj, path1);
  const value2 = _get(obj, path2);
  _set(obj, path1, value2);
  _set(obj, path2, value1);
};
