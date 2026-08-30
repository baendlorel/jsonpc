import { _isArray, _split } from './common.js';
import { _get, _delete, _exchange, _move } from './path-map.js';

export type ArrayMethods = {
  [K in keyof Array<any>]: Array<any>[K] extends Function ? K : never;
};

type Operations = {
  [K in keyof ArrayMethods]: (arr: any[], args: Parameters<Array<any>[K]>, commentsMap: any, path: any[]) => void;
};

export type SupportedArrayMethods = 'push' | 'pop' | 'shift' | 'unshift' | 'splice' | 'reverse';

const push: Operations['push'] = (arr, args) => arr.push(...args);

const pop: Operations['pop'] = (arr, _args, commentsMap, path) => (
  _delete(commentsMap, [...path, arr.length - 1]),
  arr.pop()
);

const shift: Operations['shift'] = (arr, _args, commentsMap, path) => {
  const lastIndex = arr.length - 1;
  for (let i = 0; i < lastIndex; i++) {
    _move(commentsMap, [...path, i + 1], [...path, i]);
  }
  return arr.shift();
};

const unshift: Operations['unshift'] = (arr, args, commentsMap, path) => {
  const delta = args.length;
  for (let i = arr.length - 1; i >= 0; i--) {
    _move(commentsMap, [...path, i], [...path, i + delta]);
  }

  for (let i = 0; i < delta; i++) {
    _delete(commentsMap, [...path, i]);
  }
  arr.unshift.apply(arr, args);
};

const splice: Operations['splice'] = (arr, args, commentsMap, path) => {
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

  arr.splice(...args);
};

const reverse: Operations['reverse'] = (arr, _args, commentsMap, path) => {
  const len = arr.length;
  const half = Math.floor(len / 2);
  for (let i = 0; i < half; i++) {
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
  reverse,
};
