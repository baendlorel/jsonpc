import type { PathMap } from './path-map.js';

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

export type SupportedArrayMethods = 'push' | 'pop' | 'shift' | 'unshift' | 'splice' | 'sort' | 'reverse' | 'fill';

const defaultCompare = function (a: any, b: any) {
  a = String(a);
  b = String(b);

  if (a < b) {
    return -1;
  } else if (a > b) {
    return 1;
  } else {
    return 0;
  }
};

export const arrayOpers: Partial<Operations> = {
  push: (arr, args, _commentsMap, _path) => {
    // Does nothing since commentsMap's path is not changed.
    arr.push.apply(arr, args);
  },

  pop: (arr, _args, commentsMap, propPath) => {
    commentsMap.delete([...propPath, arr.length - 1]);
    arr.pop();
  },

  shift: (arr, _args, commentsMap, path) => {
    const lastIndex = arr.length - 1;
    for (let i = 0; i < lastIndex; i++) {
      commentsMap.move([...path, i + 1], [...path, i]);
    }
    commentsMap.delete([...path, lastIndex]);
    arr.shift();
  },

  unshift: (arr, args, commentsMap, path) => {
    const delta = args.length;
    for (let i = arr.length - 1; i >= 0; i--) {
      commentsMap.move([...path, i], [...path, i + delta]);
    }

    for (let i = 0; i < delta; i++) {
      commentsMap.delete([...path, i]);
    }
    arr.unshift.apply(arr, args);
  },

  splice: (arr, args, commentsMap, path) => {
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
  },

  sort: (arr, args, commentsMap, path) => {
    const compare = args[0] || defaultCompare;
  },

  reverse: (arr, _args, commentsMap, path) => {
    const len = arr.length;
    for (let i = 0; i < Math.floor(len / 2); i++) {
      commentsMap.exchange([...path, i], [...path, len - 1 - i]);
    }
    arr.reverse();
  },
};
