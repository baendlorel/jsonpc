import { quickSort } from './array-sort.js';
import { get as _get, deleteProperty as _delete } from 'reflect-deep';
import { _isArray, _move, _exchange } from './common.js';
import { split } from './core.js';

export type ArrayMethods = {
  [K in keyof Array<any>]: Array<any>[K] extends Function ? K : never;
};

type Operations = {
  [K in keyof ArrayMethods]: (arr: any[], args: Parameters<Array<any>[K]>, commentsMap: any, path: string[]) => void;
};

export type SupportedArrayMethods = 'push' | 'pop' | 'shift' | 'unshift' | 'splice' | 'sort' | 'reverse';

export const getArray = (propPath: string | string[], data: any) => {
  const k = split(propPath);
  const arr = _get(data, k);
  if (!_isArray(arr)) {
    throw new TypeError(`The property path "${propPath}" is not an array.`);
  }
  return { k, arr };
};

export const push: Operations['push'] = (arr, args) => arr.push.apply(arr, args);

export const pop: Operations['pop'] = (arr, _args, commentsMap, path) => {
  _delete(commentsMap, [...path, arr.length - 1]);
  arr.pop();
};

export const shift: Operations['shift'] = (arr, _args, commentsMap, path) => {
  const lastIndex = arr.length - 1;
  for (let i = 0; i < lastIndex; i++) {
    _move(commentsMap, [...path, i + 1], [...path, i]);
  }
  _delete(commentsMap, [...path, lastIndex]);
  arr.shift();
};

export const unshift: Operations['unshift'] = (arr, args, commentsMap, path) => {
  const delta = args.length;
  for (let i = arr.length - 1; i >= 0; i--) {
    _move(commentsMap, [...path, i], [...path, i + delta]);
  }

  for (let i = 0; i < delta; i++) {
    _delete(commentsMap, [...path, i]);
  }
  arr.unshift.apply(arr, args);
};

export const splice: Operations['splice'] = (arr, args, commentsMap, path) => {
  const start = args[0] as number;
  const deleteCount = (args[1] as number) || 0;
  const insertCount = Math.max(0, args.length - 2);
  const netDelta = insertCount - deleteCount;

  // 1. Delete comments for removed elements in the deletion range
  for (let i = 0; i < deleteCount; i++) {
    _delete(commentsMap, [...path, start + i]);
  }

  // 2. Shift elements AFTER the affected range (elements after start + deleteCount)
  if (netDelta > 0) {
    // Elements after the affected range need to move right (insert > delete)
    for (let i = arr.length - 1; i >= start + deleteCount; i--) {
      _move(commentsMap, [...path, i], [...path, i + netDelta]);
    }
  } else if (netDelta < 0) {
    // Elements after the affected range need to move left (delete > insert)
    for (let i = start + deleteCount; i < arr.length; i++) {
      _move(commentsMap, [...path, i], [...path, i + netDelta]);
    }
  }

  // 3. Remove comments for newly inserted elements (they should be undefined)
  for (let i = 0; i < insertCount; i++) {
    _delete(commentsMap, [...path, start + i]);
  }

  arr.splice.apply(arr, args);
};

export const sort: Operations['sort'] = (arr, args, commentsMap, path) =>
  quickSort(arr, 0, arr.length - 1, commentsMap, path, args[0]);

export const reverse: Operations['reverse'] = (arr, _args, commentsMap, path) => {
  const len = arr.length;
  for (let i = 0; i < Math.floor(len / 2); i++) {
    _exchange(commentsMap, [...path, i], [...path, len - 1 - i]);
  }
  arr.reverse();
};

export const arrayOpers = {
  push,
  pop,
  shift,
  unshift,
  splice,
  sort,
  reverse,
};
