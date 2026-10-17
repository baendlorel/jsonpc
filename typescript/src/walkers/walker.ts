// ─── Types ────────────────────────────────────────────────────────────────────

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export interface JsonObject {
  [key: string]: JsonValue;
}
export type JsonArray = JsonValue[];

// ─── FullWalker ───────────────────────────────────────────────────────────────

/**
 * A self-contained JSON / JSONPC recursive-descent parser.
 *
 * Unlike the lightweight `createWorker` helper (which fires callbacks on
 * individual characters), `FullWalker` consumes the entire text in one pass
 * and returns a fully-built JavaScript value — no `JSON.parse` required.
 *
 * Supported input:
 * - Standard JSON: objects, arrays, strings, numbers, booleans, null
 * - JSONPC line-comments (`// …`) — silently skipped
 * - Trailing commas in objects and arrays — silently accepted
 *
 * @example
 * fullWalker.walk('{ "a": 1, "b": [true, null] }')
 * // → { a: 1, b: [true, null] }
 *
 * fullWalker.walk(`{
 *   // comment
 *   "x": 42,
 * }`)
 * // → { x: 42 }
 */
export class Walker {
  private text = '';
  private pos = 0;

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Parse `text` into a JavaScript value.
   * Each call resets internal state, so the instance is safe to reuse.
   * @param text Standard JSON or JSONPC text (with `// …` line comments).
   */
  walk(text: string): JsonValue {
    this.text = text;
    this.pos = 0;

    const value = this._parseValue();

    this._skipWs();
    if (this.pos < this.text.length) {
      throw new SyntaxError(`Unexpected token '${this.text[this.pos]}' at position ${this.pos}`);
    }

    return value;
  }

  // ── Dispatcher ──────────────────────────────────────────────────────────────

  private _parseValue(): JsonValue {
    this._skipWs();
    const c = this.text[this.pos];

    if (c === '"') return this._string();
    if (c === '{') return this._object();
    if (c === '[') return this._array();
    if (c === 't') return this._literal('true', true);
    if (c === 'f') return this._literal('false', false);
    if (c === 'n') return this._literal('null', null);
    if (c === '-' || (c >= '0' && c <= '9')) return this._number();

    if (c === undefined) {
      throw new SyntaxError(`Unexpected end of input`);
    }
    throw new SyntaxError(`Unexpected token '${c}' at position ${this.pos}`);
  }

  // ── Object ──────────────────────────────────────────────────────────────────

  private _object(): JsonObject {
    this.pos++; // skip '{'
    const obj: JsonObject = {};

    this._skipWs();
    if (this.text[this.pos] === '}') {
      this.pos++;
      return obj;
    }

    while (this.pos < this.text.length) {
      this._skipWs();

      if (this.text[this.pos] !== '"') {
        throw new SyntaxError(`Expected property name at position ${this.pos}`);
      }
      const key = this._string();

      this._skipWs();
      if (this.text[this.pos] !== ':') {
        throw new SyntaxError(`Expected ':' at position ${this.pos}`);
      }
      this.pos++;

      obj[key] = this._parseValue();

      this._skipWs();
      const next = this.text[this.pos];
      if (next === '}') {
        this.pos++;
        return obj;
      }
      if (next === ',') {
        this.pos++;
        // Trailing comma — peek ahead; if the next non-ws is '}', we're done.
        this._skipWs();
        if (this.text[this.pos] === '}') {
          this.pos++;
          return obj;
        }
        continue;
      }
      throw new SyntaxError(`Expected ',' or '}' at position ${this.pos}`);
    }

    throw new SyntaxError(`Unexpected end of input inside object`);
  }

  // ── Array ───────────────────────────────────────────────────────────────────

  private _array(): JsonArray {
    this.pos++; // skip '['
    const arr: JsonArray = [];

    this._skipWs();
    if (this.text[this.pos] === ']') {
      this.pos++;
      return arr;
    }

    while (this.pos < this.text.length) {
      arr.push(this._parseValue());

      this._skipWs();
      const next = this.text[this.pos];
      if (next === ']') {
        this.pos++;
        return arr;
      }
      if (next === ',') {
        this.pos++;
        // Trailing comma — peek ahead; if the next non-ws is ']', we're done.
        this._skipWs();
        if (this.text[this.pos] === ']') {
          this.pos++;
          return arr;
        }
        continue;
      }
      throw new SyntaxError(`Expected ',' or ']' at position ${this.pos}`);
    }

    throw new SyntaxError(`Unexpected end of input inside array`);
  }

  // ── String ──────────────────────────────────────────────────────────────────

  private _string(): string {
    this.pos++; // skip opening '"'
    const buf: string[] = [];

    while (this.pos < this.text.length) {
      const c = this.text[this.pos++];
      if (c === '"') return buf.join('');
      if (c === '\\') {
        buf.push(this._parseEscape());
      } else {
        buf.push(c);
      }
    }

    throw new SyntaxError(`Unterminated string`);
  }

  private _parseEscape(): string {
    const c = this.text[this.pos++];
    switch (c) {
      case '"':
        return '"';
      case '\\':
        return '\\';
      case '/':
        return '/';
      case 'b':
        return '\b';
      case 'f':
        return '\f';
      case 'n':
        return '\n';
      case 'r':
        return '\r';
      case 't':
        return '\t';
      case 'u': {
        const hex = this.text.slice(this.pos, this.pos + 4);
        if (!/^[\da-fA-F]{4}$/.test(hex)) {
          throw new SyntaxError(`Invalid unicode escape \\u${hex} at position ${this.pos}`);
        }
        this.pos += 4;
        return String.fromCharCode(parseInt(hex, 16));
      }
      default:
        throw new SyntaxError(`Unknown escape sequence '\\${c}' at position ${this.pos - 1}`);
    }
  }

  // ── Number ──────────────────────────────────────────────────────────────────

  private _number(): number {
    const start = this.pos;

    // Optional leading minus
    if (this.text[this.pos] === '-') this.pos++;

    // Integer part — JSON doesn't allow leading zeros (except bare '0')
    if (this.text[this.pos] === '0') {
      this.pos++;
    } else if (this.text[this.pos] >= '1' && this.text[this.pos] <= '9') {
      while (this.pos < this.text.length && this.text[this.pos] >= '0' && this.text[this.pos] <= '9') {
        this.pos++;
      }
    } else {
      throw new SyntaxError(`Invalid number at position ${this.pos}`);
    }

    // Optional fractional part
    if (this.text[this.pos] === '.') {
      this.pos++;
      if (this.text[this.pos] < '0' || this.text[this.pos] > '9') {
        throw new SyntaxError(`Expected digit after '.' at position ${this.pos}`);
      }
      while (this.pos < this.text.length && this.text[this.pos] >= '0' && this.text[this.pos] <= '9') {
        this.pos++;
      }
    }

    // Optional exponent part
    if (this.text[this.pos] === 'e' || this.text[this.pos] === 'E') {
      this.pos++;
      if (this.text[this.pos] === '+' || this.text[this.pos] === '-') this.pos++;
      if (this.text[this.pos] < '0' || this.text[this.pos] > '9') {
        throw new SyntaxError(`Expected digit in exponent at position ${this.pos}`);
      }
      while (this.pos < this.text.length && this.text[this.pos] >= '0' && this.text[this.pos] <= '9') {
        this.pos++;
      }
    }

    return Number(this.text.slice(start, this.pos));
  }

  // ── Literals ─────────────────────────────────────────────────────────────────

  private _literal(literal: string, value: JsonPrimitive): JsonPrimitive {
    if (this.text.startsWith(literal, this.pos)) {
      this.pos += literal.length;
      return value;
    }
    throw new SyntaxError(`Unexpected token at position ${this.pos}`);
  }

  // ── Whitespace + comment skip ─────────────────────────────────────────────

  /**
   * Advance `pos` past any combination of:
   * - ASCII whitespace (`\x20`, `\t`, `\n`, `\r`)
   * - JSONPC line comments (`// …` until end of line)
   */
  private _skipWs() {
    while (this.pos < this.text.length) {
      const c = this.text[this.pos];

      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
        this.pos++;
        continue;
      }

      // Line comment: skip everything up to (but not including) the newline
      if (c === '/' && this.text[this.pos + 1] === '/') {
        this.pos += 2;
        while (this.pos < this.text.length && this.text[this.pos] !== '\n' && this.text[this.pos] !== '\r') {
          this.pos++;
        }
        continue;
      }

      break;
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

/**
 * Shared `FullWalker` instance — safe to reuse across calls because each
 * `walk()` resets all internal state before parsing.
 */
export const fullWalker = new Walker();
