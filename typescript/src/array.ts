import type { PathMap } from './path-map.js';

export type ArrayMethods = {
  [K in keyof Array<any>]: Array<any>[K] extends Function ? K : never;
};

type Operations = {
  [K in keyof ArrayMethods]: (
    arr: any[],
    args: Parameters<Array<any>[K]>,
    commentsMap: PathMap,
    basePropPath: string[],
  ) => void;
};

export type SupportedArrayMethods = 'push' | 'pop' | 'shift' | 'unshift' | 'splice' | 'sort' | 'reverse' | 'fill';

export const arrayOpers: Partial<Operations> = {
  push: (arr, args, _commentsMap, _basePropPath) => {
    // Does nothing since commentsMap's path is not changed.
    arr.push.apply(arr, args);
  },

  pop: (arr, _args, commentsMap, propPath) => {
    commentsMap.delete([...propPath, arr.length - 1]);
    arr.pop();
  },

  shift: (arr, _args, commentsMap, basePropPath) => {
    const lastIndex = arr.length - 1;
    for (let i = 0; i < lastIndex; i++) {
      commentsMap.move([...basePropPath, i + 1], [...basePropPath, i]);
    }
    commentsMap.delete([...basePropPath, lastIndex]);
    arr.shift();
  },

  unshift: (arr, args, commentsMap, basePropPath) => {
    const delta = args.length;
    for (let i = arr.length - 1; i >= 0; i--) {
      commentsMap.move([...basePropPath, i], [...basePropPath, i + delta]);
    }

    for (let i = 0; i < delta; i++) {
      commentsMap.delete([...basePropPath, i]);
    }
    arr.unshift.apply(arr, args);
  },

  splice: (arr, args, commentsMap, basePropPath) => {
    const start = args[0] as number;
    const deleteCount = (args[1] as number) || 0;
    const insertCount = Math.max(0, args.length - 2);
    const netDelta = insertCount - deleteCount;

    // 1. Delete comments for removed elements
    for (let i = start; i < start + deleteCount; i++) {
      commentsMap.delete([...basePropPath, i]);
    }

    // 2. Shift elements after the affected range
    if (netDelta > 0) {
      // Elements after the affected range need to move right (insert > delete)
      for (let i = arr.length - 1; i >= start + deleteCount; i--) {
        commentsMap.move([...basePropPath, i], [...basePropPath, i + netDelta]);
      }
    } else if (netDelta < 0) {
      // Elements after the affected range need to move left (delete > insert)
      for (let i = start + deleteCount; i < arr.length; i++) {
        commentsMap.move([...basePropPath, i], [...basePropPath, i + netDelta]);
      }
    }
    arr.splice.apply(arr, args);
  },

  sort: (arr, _args, commentsMap, basePropPath) => {
    for (let i = 0; i < arr.length; i++) {
      commentsMap.delete([...basePropPath, i]);
    }
  },

  reverse: (arr, _args, commentsMap, basePropPath) => {
    const len = arr.length;
    for (let i = 0; i < Math.floor(len / 2); i++) {
      commentsMap.exchange([...basePropPath, i], [...basePropPath, len - 1 - i]);
    }
  },

  fill: (arr, args, commentsMap, basePropPath) => {
    const start = args[1] !== undefined ? (args[1] as number) : 0;
    const end = args[2] !== undefined ? (args[2] as number) : arr.length;

    for (let i = start; i < end; i++) {
      commentsMap.delete([...basePropPath, i]);
    }
  },
};
