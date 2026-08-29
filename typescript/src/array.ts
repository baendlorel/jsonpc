import type { PathMap } from './path-map.js';

export type ArrayFunctions = {
  [K in keyof Array<any>]: Array<any>[K] extends Function ? K : never;
};

export type ArrayOperationArgs<K extends keyof Array<any>> = K extends keyof ArrayFunctions
  ? Parameters<Array<any>[K]>
  : never;

export const arrayOpers: Record<keyof ArrayFunctions, (arr: any[], args: any[], commentsMap: PathMap) => void> = {
  push: (_arr, _args, _commentsMap) => {
    // Does nothing since commentsMap's path is not changed.
  },
};
