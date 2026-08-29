type ArrayFunctions = {
  [K in keyof Array<any>]: Array<any>[K] extends Function ? K : never;
};

type ArrayOperationArgs<K extends keyof Array<any>> = K extends keyof ArrayFunctions
  ? Parameters<Array<any>[K]>
  : never;

export const arrayOpers: ArrayFunctions = {};
