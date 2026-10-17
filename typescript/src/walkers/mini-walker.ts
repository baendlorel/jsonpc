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

  onComma: (args: WalkerHandlerArgs, stop: () => void) => void;
  onColon: (args: WalkerHandlerArgs, stop: () => void) => void;
  onQuote: (args: WalkerHandlerArgsWithSides, stop: () => void) => void;
  onBrace: (args: WalkerHandlerArgsWithSides, stop: () => void) => void;
  onBracket: (args: WalkerHandlerArgsWithSides, stop: () => void) => void;
  /** Triggers when `inString === true` and char is `\` (next char is escaped). */
  onEscape: (args: WalkerHandlerArgs, stop: () => void) => void;
  onInString: (args: WalkerHandlerArgs, stop: () => void) => void;
  /** Triggers when char is none of the above. */
  onOther: (args: WalkerHandlerArgs, stop: () => void) => void;
  afterChar: (args: WalkerHandlerArgs, stop: () => void) => void;

  /**
   * Fires once for each object-property value (the right-hand side of `:`),
   * immediately after the full value has been consumed.
   *
   * Values nested deeper (inside an object or array value) do **not** emit
   * their own `onValue` — they are covered by the outer value's `v`.
   */
  onValue: (args: WalkerHandlerArgsWithValue, stop: () => void) => void;
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
  AfterColon = 1, // saw ':', skipping whitespace before value starts
  InString = 2, // value is a string ("…")
  InNested = 3, // value is an object/array; tracking brace/bracket depth
  InLiteral = 4, // value is a literal (number / bool / null)
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
    let valueDepth = 0;
    let literalEnd = -1;

    for (let i = start; i < end; i++) {
      const c = t[i];

      if (escaped) {
        escaped = false;
        onInString({ i, c, t }, stop);
      } else if (c === '\\') {
        if (!inString) {
          throw new Error(`Unexpected escape character at position ${i} outside of a string.`);
        }
        escaped = true;
        onEscape({ i, c, t }, stop);
        onInString({ i, c, t }, stop);
      } else if (inString) {
        if (c === '"') {
          inString = false;
          onQuote({ i, c, t, side: Side.Right }, stop);
          // String value just finished.
          if (trackValues && vs === VisitState.InString) {
            onValue({ i, c, t, s: valueStart, v: t.slice(valueStart, i + 1) }, stop);
            vs = VisitState.Idle;
          }
        } else {
          onInString({ i, c, t }, stop);
        }
      } else if (trackValues) {
        // ── Outside a string, with value tracking ──────────────────────────

        // Save vs before pre-checks so the switch knows whether this char
        // *opened* InNested (prevVs === AfterColon) or is a deeper delimiter
        // inside an already-tracked nested value (prevVs === InNested).
        const prevVs = vs;

        // Pre-check 1 — a literal ends right before its terminating char.
        if (
          vs === VisitState.InLiteral &&
          (c === ',' || c === '}' || c === ']' || c === ' ' || c === '\t' || c === '\n' || c === '\r')
        ) {
          onValue({ i: literalEnd, c: t[literalEnd], s: valueStart, t, v: t.slice(valueStart, literalEnd + 1) }, stop);
          vs = VisitState.Idle;
        }

        // Pre-check 2 — first non-whitespace char after ':' opens the value.
        if (vs === VisitState.AfterColon && c !== ' ' && c !== '\t' && c !== '\n' && c !== '\r') {
          valueStart = i;
          if (c === '"') {
            vs = VisitState.InString;
          } else if (c === '{' || c === '[') {
            vs = VisitState.InNested;
            valueDepth = 1; // this char itself is depth 1; not counted again below
          } else {
            vs = VisitState.InLiteral;
            literalEnd = i;
          }
        }

        switch (c) {
          case ',':
            onComma({ i, c, t }, stop);
            break;
          case ':':
            onColon({ i, c, t }, stop);
            if (vs === VisitState.Idle) vs = VisitState.AfterColon;
            break;
          case '"':
            inString = true;
            onQuote({ i, c, t, side: Side.Left }, stop);
            break;
          case '{':
            // Increment depth only when we were *already* inside a nested value
            // (prevVs === InNested).  The opening '{' that started InNested was
            // handled by Pre-check 2 above (depth already set to 1).
            if (prevVs === VisitState.InNested) valueDepth++;
            onBrace({ i, c, t, side: Side.Left }, stop);
            break;
          case '}':
            if (vs === VisitState.InNested && --valueDepth === 0) {
              onValue({ i, c, t, s: valueStart, v: t.slice(valueStart, i + 1) }, stop);
              vs = VisitState.Idle;
            }
            onBrace({ i, c, t, side: Side.Right }, stop);
            break;
          case '[':
            if (prevVs === VisitState.InNested) valueDepth++;
            onBracket({ i, c, t, side: Side.Left }, stop);
            break;
          case ']':
            if (vs === VisitState.InNested && --valueDepth === 0) {
              onValue({ i, c, t, s: valueStart, v: t.slice(valueStart, i + 1) }, stop);
              vs = VisitState.Idle;
            }
            onBracket({ i, c, t, side: Side.Right }, stop);
            break;
          default:
            if (vs === VisitState.InLiteral) literalEnd = i; // keep cursor at last literal char
            onOther({ i, c, t }, stop);
            break;
        }
      } else {
        // ── Outside a string, fast path (no onValue tracking) ──────────────
        switch (c) {
          case ',':
            onComma({ i, c, t }, stop);
            break;
          case ':':
            onColon({ i, c, t }, stop);
            break;
          case '"':
            inString = true;
            onQuote({ i, c, t, side: Side.Left }, stop);
            break;
          case '{':
            onBrace({ i, c, t, side: Side.Left }, stop);
            break;
          case '}':
            onBrace({ i, c, t, side: Side.Right }, stop);
            break;
          case '[':
            onBracket({ i, c, t, side: Side.Left }, stop);
            break;
          case ']':
            onBracket({ i, c, t, side: Side.Right }, stop);
            break;
          default:
            onOther({ i, c, t }, stop);
            break;
        }
      }
      afterChar({ i, c, t }, stop);
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
