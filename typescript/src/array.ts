import type { PathMap } from './path-map.js';
import { quickSort } from './array-sort.js';
import { ReflectDeep } from 'reflect-deep';
import { _isArray } from './common.js';

export type ArrayMethods = {
  [K in keyof Array<any>]: Array<any>[K] extends Function ? K : never;
};

type Operations = {
  [K in keyof ArrayMethods]: (
    arr: any[],
    args: Parameters<Array<any>[K]>,
    commentsMap: PathMap,
    path: string[],
  ) => void;
};

export type SupportedArrayMethods = 'push' | 'pop' | 'shift' | 'unshift' | 'splice' | 'sort' | 'reverse';

export const getArray = (propPath: string, data: any) => {
  const k = propPath.split('.');
  const arr = ReflectDeep.get(data, k);
  if (!_isArray(arr)) {
    throw new TypeError(`The property path "${propPath}" is not an array.`);
  }
  return { k, arr };
};

export const push: Operations['push'] = (arr, args) => arr.push.apply(arr, args);

export const pop: Operations['pop'] = (arr, _args, commentsMap, path) => {
  commentsMap.delete([...path, arr.length - 1]);
  arr.pop();
};

export const shift: Operations['shift'] = (arr, _args, commentsMap, path) => {
  const lastIndex = arr.length - 1;
  for (let i = 0; i < lastIndex; i++) {
    commentsMap.move([...path, i + 1], [...path, i]);
  }
  commentsMap.delete([...path, lastIndex]);
  arr.shift();
};

export const unshift: Operations['unshift'] = (arr, args, commentsMap, path) => {
  const delta = args.length;
  for (let i = arr.length - 1; i >= 0; i--) {
    commentsMap.move([...path, i], [...path, i + delta]);
  }

  for (let i = 0; i < delta; i++) {
    commentsMap.delete([...path, i]);
  }
  arr.unshift.apply(arr, args);
};

export const splice: Operations['splice'] = (arr, args, commentsMap, path) => {
  const start = args[0] as number;
  const deleteCount = (args[1] as number) || 0;
  const insertCount = Math.max(0, args.length - 2);
  const netDelta = insertCount - deleteCount;

  // 1. Delete comments for removed elements
  for (let i = start; i < start + deleteCount; i++) {
    commentsMap.delete([...path, i]);
  }

  // 2. Shift elements after the affected range
  if (netDelta > 0) {
    // Elements after the affected range need to move right (insert > delete)
    for (let i = arr.length - 1; i >= start + deleteCount; i--) {
      commentsMap.move([...path, i], [...path, i + netDelta]);
    }
  } else if (netDelta < 0) {
    // Elements after the affected range need to move left (delete > insert)
    for (let i = start + deleteCount; i < arr.length; i++) {
      commentsMap.move([...path, i], [...path, i + netDelta]);
    }
  }
  arr.splice.apply(arr, args);
};

export const sort: Operations['sort'] = (arr, args, commentsMap, path) =>
  quickSort(arr, 0, arr.length - 1, commentsMap, path, args[0]);

export const reverse: Operations['reverse'] = (arr, _args, commentsMap, path) => {
  const len = arr.length;
  for (let i = 0; i < Math.floor(len / 2); i++) {
    commentsMap.exchange([...path, i], [...path, len - 1 - i]);
  }
  arr.reverse();
};

export class ArrayOperator {
  /**
   * Map a property path to a comment string array.
   *
   * Reference of the JSONPC instance's commentMap, not a copy.
   */
  private commentMap: PathMap;

  /**
   * Reference of the JSONPC instance's data, not a copy.
   */
  private data: any;

  private basePath: string[];

  constructor(data: any, commentMap: PathMap, basePath: string[]) {
    this.data = data;
    this.commentMap = commentMap;
    this.basePath = basePath;
  }

  destroy() {
    this.data = null as any;
    this.commentMap = null as any;

    this.basePath.length = 0;
    this.basePath = null as any;
  }
}
