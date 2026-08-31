const C = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz/*-+^&*$#@%!~';
const _f = Math.floor;
const _r = Math.random;
const r = () => C[_f(_r() * 75)];
export const genUname = (origin: string) => origin + SEP + 'xxxxxxxxx'.replace(/[x]/g, r);

/**
 * ! Use this after checking whether it's a uname or not.
 */
export const stripUname = (uname: string) => uname.slice(0, uname.length - 10);

/**
 * Uname -> Original name
 *
 * reverse:
 */
export class UnameMap extends Map<string, string> {
  readonly reverse: Map<string, Set<string>> = new Map();

  set(key: string, value: string): this {
    const existing = this.reverse.get(value);
    if (existing) {
      existing.add(key);
    } else {
      this.reverse.set(value, new Set([key]));
    }
    return super.set(key, value);
  }

  delete(key: string): boolean {
    const value = this.get(key);
    if (value) {
      const existing = this.reverse.get(value);
      if (existing) {
        existing.delete(key);
        if (existing.size === 0) {
          this.reverse.delete(value);
        }
      }
    }
    return super.delete(key);
  }

  /**
   * Generate a new uname and add it to the map.
   * @param origin
   * @returns a new uname
   */
  add(origin: string): string {
    const uname = genUname(origin);
    this.set(uname, origin);
    return uname;
  }
}
