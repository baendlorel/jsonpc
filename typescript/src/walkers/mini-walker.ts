import { _noop } from '../core/common.js';

/**
 * This state is not needed by `MiniWalker` itself, but is used by walkers
 * that are built on top of it.
 */
export const enum WalkState {
  Idle,
  Start,
  Searching,
  Found,
}

export const enum Side {
  Left,
  Right,
}

export interface WalkerHandlerArgs {
  /** Current character index */
  i: number;
  /** Current character */
  c: string;
  /** Full text */
  t: string;

  stop: () => void;

  /**
   * This walker instance.
   */
  w: MiniWalker;
}

export interface WalkerHandlerArgsWithSides extends WalkerHandlerArgs {
  side: Side;
}

export interface WalkerHandlerArgsWithValue extends WalkerHandlerArgs {
  /**
   * Raw source text of the complete value that just finished.
   * - **String** : includes the surrounding quotes, e.g. `"hello"`
   * - **Object** : includes the braces, e.g. `{ "x": 1 }`
   * - **Array**  : includes the brackets, e.g. `[1, 2]`
   * - **Literal**: bare token, e.g. `42`, `true`, `null`
   *
   * For string / object / array values `i`/`c` point to the closing delimiter.
   * For literal values `i`/`c` point to the **last character of the token**
   * (not to the following separator).
   *
   * Values nested inside an object/array value are NOT reported individually —
   * they are part of the outer value's `v`.
   */
  v: string;

  /**
   * Value start position.
   */
  s: number;
}

/** Only triggered on chars that are not inside a string. */
interface WalkerOptions {
  text: string;
  inString: boolean;

  onComma: (args: WalkerHandlerArgs) => void;
  onColon: (args: WalkerHandlerArgs) => void;
  onQuote: (args: WalkerHandlerArgsWithSides) => void;
  onBrace: (args: WalkerHandlerArgsWithSides) => void;
  onBracket: (args: WalkerHandlerArgsWithSides) => void;
  /** Triggers when `inString === true` and char is `\` (next char is escaped). */
  onEscape: (args: WalkerHandlerArgs) => void;
  onInString: (args: WalkerHandlerArgs) => void;
  /** Triggers when char is none of the above. */
  onOther: (args: WalkerHandlerArgs) => void;
  afterChar: (args: WalkerHandlerArgs) => void;

  /**
   * Fires for every JSON value at **any depth**:
   *
   * - **Scalars** (string / number / bool / null / bare literal like `NaN`):
   *   fired when the token ends.
   * - **Object / array** that appears as a value (i.e. is the RHS of `:` or
   *   an element of an enclosing array): fired when its closing `}`/`]` is
   *   reached, with `v` containing the full source text including delimiters.
   *
   * Both levels fire independently — for `"arr": [NaN, 1]` you get three
   * calls: `NaN`, `1`, and `[NaN, 1]`.
   *
   * A top-level `{…}` or `[…]` that is not itself a property value does
   * **not** fire; only its contents do.
   *
   * `s` / `i` are the start / end positions in the source text, useful for
   * in-place replacements via {@link MiniWalker.replace}.
   */
  onValue: (args: WalkerHandlerArgsWithValue) => void;
}

const enum Op {
  Replace,
  Insert,
  Delete,
}

interface Ops {
  start: number;
  end: number;
  text: string;
  op: Op;
}

// Internal enum for value-boundary tracking (not exported).
const enum VisitState {
  Idle = 0, // not tracking any value
  AfterColon = 1, // saw ':' or opened '['; skipping whitespace before value starts
  InString = 2, // value is a string ("…")
  InLiteral = 3, // value is a literal (number / bool / null / bare token)
}

export class MiniWalker {
  private onComma: WalkerOptions['onComma'];
  private onColon: WalkerOptions['onColon'];
  private onQuote: WalkerOptions['onQuote'];
  private onBrace: WalkerOptions['onBrace'];
  private onBracket: WalkerOptions['onBracket'];
  private onEscape: WalkerOptions['onEscape'];
  private onInString: WalkerOptions['onInString'];
  private onOther: WalkerOptions['onOther'];
  private afterChar: WalkerOptions['afterChar'];
  private onValue: WalkerOptions['onValue'];

  private inString: boolean;
  private text = '';
  private ops: Ops[] = [];

  constructor({
    text,
    inString = false,
    onComma = _noop,
    onColon = _noop,
    onQuote = _noop,
    onBrace = _noop,
    onBracket = _noop,
    onEscape = _noop,
    onInString = _noop,
    onOther = _noop,
    afterChar = _noop,
    onValue = _noop,
  }: Partial<WalkerOptions>) {
    this.inString = inString;
    this.text = text!;
    this.onComma = onComma;
    this.onColon = onColon;
    this.onQuote = onQuote;
    this.onBrace = onBrace;
    this.onBracket = onBracket;
    this.onEscape = onEscape;
    this.onInString = onInString;
    this.onOther = onOther;
    this.afterChar = afterChar;
    this.onValue = onValue;
  }

  run(start = 0, end = this.text.length): this {
    const t = this.text;
    let inString = this.inString;
    let escaped = false;
    const stop = () => (end = NaN);

    // Hoist to locals to avoid repeated property lookups in the hot loop.
    const { onComma, onColon, onQuote, onBrace, onBracket, onEscape, onInString, onOther, afterChar, onValue } = this;

    // Value-tracking state — reset fresh every run().
    // Skip all overhead when onValue was not provided.
    const trackValues = onValue !== (_noop as any);
    let vs = VisitState.Idle;
    let valueStart = -1;
    let literalEnd = -1;
    // Each frame = [isArray, fireOnClose, openPos].
    //   isArray    – true when opened by `[` (comma re-arms AfterColon for next item).
    //   fireOnClose – true when this `{`/`[` is itself a value (appeared after `:` or
    //                 as an array item), so onValue fires with the whole text on close.
    //   openPos    – char position of the opening `{` or `[` (for the v slice).
    const nestStack: [boolean, boolean, number][] = [];

    for (let i = start; i < end; i++) {
      const c = t[i];

      if (escaped) {
        escaped = false;
        onInString({ i, c, t, stop, w: this });
      } else if (c === '\\') {
        if (!inString) {
          throw new Error(`Unexpected escape character at position ${i} outside of a string.`);
        }
        escaped = true;
        onEscape({ i, c, t, stop, w: this });
        onInString({ i, c, t, stop, w: this });
      } else if (inString) {
        if (c === '"') {
          inString = false;
          onQuote({ i, c, t, side: Side.Right, stop, w: this });
          // String value just finished.
          if (trackValues && vs === VisitState.InString) {
            onValue({ i, c, t, s: valueStart, v: t.slice(valueStart, i + 1), stop, w: this });
            vs = VisitState.Idle;
          }
        } else {
          onInString({ i, c, t, stop, w: this });
        }
      } else if (trackValues) {
        // ── Outside a string, with value tracking ──────────────────────────
        //
        // nestStack frame = [isArray, fireOnClose, openPos].
        // Every `{`/`[` pushes a frame; every `}`/`]` pops one.
        // isArray=true  → comma re-arms AfterColon for next array item.
        // fireOnClose   → the bracket is itself a value (after `:` or inside an
        //                 array), so onValue fires for the WHOLE text on close.

        // Pre-check 1 — a literal ends right before its terminating char.
        if (
          vs === VisitState.InLiteral &&
          (c === ',' || c === '}' || c === ']' || c === ' ' || c === '\t' || c === '\n' || c === '\r')
        ) {
          onValue({
            i: literalEnd,
            c: t[literalEnd],
            s: valueStart,
            t,
            v: t.slice(valueStart, literalEnd + 1),
            stop,
            w: this,
          });
          vs = VisitState.Idle;
        }

        // Pre-check 2 — first non-whitespace char after ':' / '[' opens a value.
        // `{` and `[` are left for the switch (it inspects vs to set fireOnClose).
        // Closing chars / ',' reset to Idle to handle empty arrays gracefully.
        if (vs === VisitState.AfterColon && c !== ' ' && c !== '\t' && c !== '\n' && c !== '\r') {
          if (c === '{' || c === '[') {
            // leave vs === AfterColon so the switch can detect fireOnClose
          } else if (c === ']' || c === '}' || c === ',') {
            vs = VisitState.Idle;
          } else {
            valueStart = i;
            if (c === '"') {
              vs = VisitState.InString;
            } else {
              vs = VisitState.InLiteral;
              literalEnd = i;
            }
          }
        }

        switch (c) {
          case ',':
            onComma({ i, c, t, stop, w: this });
            // In an array context, comma arms tracking for the next item.
            if (vs === VisitState.Idle && nestStack.length > 0 && nestStack[nestStack.length - 1][0]) {
              vs = VisitState.AfterColon;
            }
            break;
          case ':':
            onColon({ i, c, t, stop, w: this });
            if (vs === VisitState.Idle) vs = VisitState.AfterColon;
            break;
          case '"':
            inString = true;
            onQuote({ i, c, t, side: Side.Left, stop, w: this });
            break;
          case '{': {
            // fireOnClose = true when this { is itself a value (after : or as array item)
            const fireOnClose = vs === VisitState.AfterColon;
            nestStack.push([false, fireOnClose, i]);
            vs = VisitState.Idle;
            valueStart = -1;
            literalEnd = -1;
            onBrace({ i, c, t, side: Side.Left, stop, w: this });
            break;
          }
          case '}': {
            const frame = nestStack.pop()!;
            if (frame[1]) {
              // This { was a value — report the whole object text.
              onValue({ i, c, t, s: frame[2], v: t.slice(frame[2], i + 1), stop, w: this });
            }
            vs = VisitState.Idle;
            valueStart = -1;
            literalEnd = -1;
            onBrace({ i, c, t, side: Side.Right, stop, w: this });
            break;
          }
          case '[': {
            const fireOnClose = vs === VisitState.AfterColon;
            nestStack.push([true, fireOnClose, i]);
            vs = VisitState.AfterColon; // arm tracking for first array item
            valueStart = -1;
            literalEnd = -1;
            onBracket({ i, c, t, side: Side.Left, stop, w: this });
            break;
          }
          case ']': {
            const frame = nestStack.pop()!;
            if (frame[1]) {
              // This [ was a value — report the whole array text.
              onValue({ i, c, t, s: frame[2], v: t.slice(frame[2], i + 1), stop, w: this });
            }
            vs = VisitState.Idle;
            valueStart = -1;
            literalEnd = -1;
            onBracket({ i, c, t, side: Side.Right, stop, w: this });
            break;
          }
          default:
            if (vs === VisitState.InLiteral) literalEnd = i; // keep cursor at last literal char
            onOther({ i, c, t, stop, w: this });
            break;
        }
      } else {
        // ── Outside a string, fast path (no onValue tracking) ──────────────
        switch (c) {
          case ',':
            onComma({ i, c, t, stop, w: this });
            break;
          case ':':
            onColon({ i, c, t, stop, w: this });
            break;
          case '"':
            inString = true;
            onQuote({ i, c, t, side: Side.Left, stop, w: this });
            break;
          case '{':
            onBrace({ i, c, t, side: Side.Left, stop, w: this });
            break;
          case '}':
            onBrace({ i, c, t, side: Side.Right, stop, w: this });
            break;
          case '[':
            onBracket({ i, c, t, side: Side.Left, stop, w: this });
            break;
          case ']':
            onBracket({ i, c, t, side: Side.Right, stop, w: this });
            break;
          default:
            onOther({ i, c, t, stop, w: this });
            break;
        }
      }
      afterChar({ i, c, t, stop, w: this });
    }
    return this;
  }

  /**
   * Reset properties for reusing the instance.
   * - `inString` resets to `false` unless explicitly provided.
   */
  reset(args: { text?: string; inString?: boolean }): this {
    if ('text' in args) this.text = args.text!;
    this.inString = args.inString ?? false;
    this.ops = [];
    return this;
  }

  replace(start: number, end: number, text: string): this {
    this.ops.push({ start, end, text, op: Op.Replace });
    return this;
  }

  insert(start: number, text: string): this {
    this.ops.push({ start, end: 0, text, op: Op.Insert });
    return this;
  }

  delete(start: number, end: number): this {
    this.ops.push({ start, end, text: '', op: Op.Delete });
    return this;
  }

  apply(): string {
    const ops = [...this.ops].sort((a, b) => a.start - b.start);

    const parts: string[] = [];
    let cursor = 0;

    for (const { start, end, text, op } of ops) {
      parts.push(this.text.slice(cursor, start), text);

      if (op !== Op.Insert) {
        cursor = end;
      } else {
        cursor = start;
      }
    }

    parts.push(this.text.slice(cursor));

    return parts.join('');
  }
}

/**
 * @deprecated Use `new MiniWalker(options)` instead.
 */
export const createWorker = (options: Partial<WalkerOptions>) => new MiniWalker(options);
