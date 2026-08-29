import type { PathMap } from './path-map.js';

export type ArrayFunctions = {
  [K in keyof Array<any>]: Array<any>[K] extends Function ? K : never;
};

export type ArrayOperationArgs<K extends keyof Array<any>> = K extends keyof ArrayFunctions
  ? Parameters<Array<any>[K]>
  : never;

/**
 * Helper to shift array indices in PathMap
 * @param basePropPath The base path to the array (e.g., ["arr"])
 * @param commentsMap The PathMap to update
 * @param startIdx The starting index to shift from (inclusive)
 * @param offset The offset to apply (positive for increment, negative for decrement)
 */
function shiftArrayIndices(basePropPath: string[], commentsMap: PathMap, startIdx: number, offset: number): void {
  if (offset === 0) return;

  // Collect all affected paths and their new indices
  const affectedPaths: Array<{ oldPath: string[]; newPath: string[] }> = [];

  // We need to iterate through the PathMap to find all array element paths
  // Since PathMap is nested, we need to traverse it
  const traverse = (currentMap: Map<any, any>, currentPath: string[]) => {
    for (const [key, value] of currentMap.entries()) {
      const newPath = [...currentPath, key];

      if (value instanceof Map) {
        traverse(value, newPath);
      } else {
        // This is a leaf node (comment array)
        // Check if this path corresponds to an array element
        const pathLen = newPath.length;
        if (pathLen > basePropPath.length) {
          const arrayIdxStr = newPath[basePropPath.length];
          const arrayIdx = parseInt(arrayIdxStr, 10);

          if (!isNaN(arrayIdx) && arrayIdx >= startIdx) {
            // This is an array element index that needs to be shifted
            const newIdx = arrayIdx + offset;
            const updatedPath = [...newPath];
            updatedPath[basePropPath.length] = newIdx.toString();

            affectedPaths.push({ oldPath: newPath, newPath: updatedPath });
          }
        }
      }
    }
  };

  // Start traversal from the base path in the PathMap
  const baseMap = commentsMap.get(basePropPath);
  if (baseMap instanceof Map) {
    traverse(baseMap, basePropPath);
  }

  // Apply the shifts (move comments to new paths)
  for (const { oldPath, newPath } of affectedPaths) {
    const comments = commentsMap.get(oldPath);
    if (comments !== undefined) {
      commentsMap.set(newPath, comments);
      commentsMap.delete(oldPath);
    }
  }
}

export const arrayOpers: Partial<Record<keyof ArrayFunctions, (arr: any[], args: any[], commentsMap: PathMap, basePropPath: string[]) => void>> = {
  push: (_arr, _args, _commentsMap, _basePropPath) => {
    // Does nothing since commentsMap's path is not changed.
  },

  pop: (arr, _args, commentsMap, basePropPath) => {
    // Remove the last index's comments
    const lastIndex = arr.length; // After pop, this was the last index
    commentsMap.delete([...basePropPath, lastIndex.toString()]);
  },

  shift: (arr, _args, commentsMap, basePropPath) => {
    // All indices decrease by 1
    // Shift all indices starting from 0 (inclusive)
    shiftArrayIndices(basePropPath, commentsMap, 0, -1);

    // Remove the comment for index 0 (the shifted-out element)
    commentsMap.delete([...basePropPath, '0']);
  },

  unshift: (arr, _args, commentsMap, basePropPath) => {
    // All indices increase by 1
    // Shift all indices starting from 0 (inclusive)
    shiftArrayIndices(basePropPath, commentsMap, 0, 1);
  },

  splice: (arr, args, commentsMap, basePropPath) => {
    const start = args[0] as number;
    const deleteCount = args[1] as number || 0;
    const insertCount = Math.max(0, args.length - 2);

    if (deleteCount > 0) {
      // Remove comments for deleted indices
      for (let i = start; i < start + deleteCount; i++) {
        commentsMap.delete([...basePropPath, i.toString()]);
      }
    }

    if (insertCount !== deleteCount) {
      // Shift indices for elements after the affected range
      const offset = insertCount - deleteCount;
      shiftArrayIndices(basePropPath, commentsMap, start + deleteCount, offset);
    }
  },

  sort: (arr, _args, commentsMap, basePropPath) => {
    // Sort changes the order of elements, so we need to remap comments
    // We need to know the original order vs the new order
    // Since we only have the sorted array, we'll need to track this during the sort operation
    // For now, we'll collect all comments before sort and try to preserve them by value matching

    // This is complex because sort doesn't provide information about which element moved where
    // The most reliable approach is to clear all array element comments for this path
    // Or, we could require users to re-set comments after sort
    // For now, let's just clear comments for this array's elements

    const traverseAndDelete = (currentMap: Map<any, any>, currentPath: string[]) => {
      for (const [key, value] of Array.from(currentMap.entries())) {
        const newPath = [...currentPath, key];

        if (value instanceof Map) {
          traverseAndDelete(value, newPath);
        } else {
          // Check if this path is under our basePropPath
          if (newPath.length > basePropPath.length) {
            const potentialIdx = newPath[basePropPath.length];
            if (!isNaN(parseInt(potentialIdx, 10))) {
              commentsMap.delete(newPath);
            }
          }
        }
      }
    };

    const baseMap = commentsMap.get(basePropPath);
    if (baseMap instanceof Map) {
      traverseAndDelete(baseMap, basePropPath);
    }
  },

  reverse: (arr, _args, commentsMap, basePropPath) => {
    // Reverse changes the order: index i becomes length - 1 - i
    const len = arr.length;

    // Collect all comments for array elements
    const elementComments: Map<string, any[]> = new Map();

    const traverseAndCollect = (currentMap: Map<any, any>, currentPath: string[]) => {
      for (const [key, value] of Array.from(currentMap.entries())) {
        const newPath = [...currentPath, key];

        if (value instanceof Map) {
          traverseAndCollect(value, newPath);
        } else {
          if (newPath.length > basePropPath.length) {
            const idxStr = newPath[basePropPath.length];
            const idx = parseInt(idxStr, 10);
            if (!isNaN(idx)) {
              elementComments.set(idxStr, value);
            }
          }
        }
      }
    };

    const baseMap = commentsMap.get(basePropPath);
    if (baseMap instanceof Map) {
      traverseAndCollect(baseMap, basePropPath);
    }

    // Delete old paths
    for (const idxStr of elementComments.keys()) {
      commentsMap.delete([...basePropPath, idxStr]);
    }

    // Reassign comments to reversed indices
    for (const [oldIdxStr, comments] of elementComments.entries()) {
      const oldIdx = parseInt(oldIdxStr, 10);
      const newIdx = len - 1 - oldIdx;
      commentsMap.set([...basePropPath, newIdx.toString()], comments);
    }
  },

  fill: (arr, args, commentsMap, basePropPath) => {
    // fill replaces values, so we should clear comments for the affected range
    const value = args[0];
    const start = args[1] !== undefined ? args[1] as number : 0;
    const end = args[2] !== undefined ? args[2] as number : arr.length;

    for (let i = start; i < end; i++) {
      commentsMap.delete([...basePropPath, i.toString()]);
    }
  },
};
