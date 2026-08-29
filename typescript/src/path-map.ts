function clear(map: Map<any, any>) {
  map.forEach((v) => {
    if (v instanceof Map) {
      clear(v);
    }
  });
  map.clear();
}

/**
 * This is a Map that use an array of keys to map to a value.
 *
 * Used to store comments string array.
 */
export class PathMap {
  private map = new Map<any, any>();

  get<V = any>(keys: any[]): V | undefined {
    let cur = this.map;
    for (let i = 0; i < keys.length; i++) {
      const next = cur.get(keys[i]);
      if (next === undefined) {
        return undefined;
      }
      cur = next;
    }
    return cur as V;
  }

  set(keys: any[], value: any) {
    let cur = this.map;
    for (let i = 0; i < keys.length - 1; i++) {
      let next = cur.get(keys[i]);
      if (next instanceof Map === false) {
        cur.set(keys[i], (next = new Map()));
      }
      cur = next;
    }
    cur.set(keys[keys.length - 1], value);
  }

  delete(keys: any[]) {
    let cur = this.map;
    for (let i = 0; i < keys.length - 1; i++) {
      let next = cur.get(keys[i]);
      if (next instanceof Map === false) {
        return;
      }
      cur = next;
    }
    cur.delete(keys[keys.length - 1]);
  }

  move(oldKeys: any[], newKeys: any[]) {
    const value = this.get(oldKeys);
    if (value === undefined) {
      return;
    }
    this.delete(oldKeys);
    this.set(newKeys, value);
  }

  exchange(akeys: any[], bkeys: any[]) {
    const aValue = this.get(akeys);
    const bValue = this.get(bkeys);

    if (aValue === undefined && bValue === undefined) {
      return;
    }

    // Delete both first to ensure clean state
    this.delete(akeys);
    this.delete(bkeys);

    // Then set values that exist
    if (bValue !== undefined) {
      this.set(akeys, bValue);
    }
    if (aValue !== undefined) {
      this.set(bkeys, aValue);
    }
  }

  clear() {
    clear(this.map);
  }
}
