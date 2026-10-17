import { _noop } from '../core/common.js';

/**
 * This state is not needed by `MiniWalker` class, but is used by some walkers that are built on top of it.
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
  /**
   * Current character index
   */
  i: number;

  /**
   * Current character
   */
  c: string;

  /**
   * Full text
   */
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
   * For string / object / array values `i`/`c` point to the closing
   * delimiter (`"`, `}`, `]`).  For literal values `i`/`c` point to the
   * **last character of the token** (not to the following separator).
   *
   * Note: values nested inside an object/array value are NOT reported
   * individually — they are included in the outer value's `v`.
   */
  v: string;
}

/**
 * Only triggered on chars that are not inside a string.
 */
interface WalkerOptions {
  inString: boolean;

  onComma: (args: WalkerHandlerArgs, stop: () => void) => void;
  onColon: (args: WalkerHandlerArgs, stop: () => void) => void;
  onQuote: (args: WalkerHandlerArgsWithSides, stop: () => void) => void;
  onBrace: (args: WalkerHandlerArgsWithSides, stop: () => void) => void;
  onBracket: (args: WalkerHandlerArgsWithSides, stop: () => void) => void;
  /**
   * Triggers when `inString === true` and char is `\`, which means the next char is escaped.
   */
  onEscape: (args: WalkerHandlerArgs, stop: () => void) => void;
  onInString: (args: WalkerHandlerArgs, stop: () => void) => void;

  /**
   * Triggers when char is none of above.
   */
  onOther: (args: WalkerHandlerArgs, stop: () => void) => void;
  afterChar: (args: WalkerHandlerArgs, stop: () => void) => void;

  /**
   * Fires once for each object-property value (the right-hand side of `:`),
   * immediately after the full value has been consumed.
   *
   * Values nested deeper (inside an object or array value) do **not** emit
   * their own `onValue` — they are part of the enclosing value's `v`.
   */
  onValue: (args: WalkerHandlerArgsWithValue, stop: () => void) => void;
}

// Internal state for value-boundary tracking (not exported).
const enum VisitState {
  Idle = 0, // not tracking any value
  AfterColon = 1, // saw ':', skipping whitespace before value starts
  InString = 2, // value is a string ("…")
  InNested = 3, // value is an object/array, tracking brace/bracket depth
  InLiteral = 4, // value is a literal (number / bool / null)
}

export class MiniWalker {
  private _inString: boolean;
  private _onComma: WalkerOptions['onComma'];
  private _onColon: WalkerOptions['onColon'];
  private _onQuote: WalkerOptions['onQuote'];
  private _onBrace: WalkerOptions['onBrace'];
  private _onBracket: WalkerOptions['onBracket'];
  private _onEscape: WalkerOptions['onEscape'];
  private _onInString: WalkerOptions['onInString'];
  private _onOther: WalkerOptions['onOther'];
  private _afterChar: WalkerOptions['afterChar'];
  private _onValue: WalkerOptions['onValue'];
  private _t = '';

  constructor({
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
    this._inString = inString;
    this._onComma = onComma;
    this._onColon = onColon;
    this._onQuote = onQuote;
    this._onBrace = onBrace;
    this._onBracket = onBracket;
    this._onEscape = onEscape;
    this._onInString = onInString;
    this._onOther = onOther;
    this._afterChar = afterChar;
    this._onValue = onValue;
  }

  run(start = 0, end = this._t.length): this {
    const t = this._t;
    let inString = this._inString;
    let escaped = false;
    const stop = () => (end = NaN);

    // Hoist callbacks to local vars to avoid repeated property lookups.
    const onComma = this._onComma;
    const onColon = this._onColon;
    const onQuote = this._onQuote;
    const onBrace = this._onBrace;
    const onBracket = this._onBracket;
    const onEscape = this._onEscape;
    const onInString = this._onInString;
    const onOther = this._onOther;
    const afterChar = this._afterChar;
    const onValue = this._onValue;

    // Value-tracking state — reset fresh each run().
    // Skip all tracking work when onValue was not provided (saves branching).
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
          // A string value just finished.
          if (trackValues && vs === VisitState.InString) {
            onValue({ i, c, t, v: t.slice(valueStart, i + 1) }, stop);
            vs = VisitState.Idle;
          }
        } else {
          onInString({ i, c, t }, stop);
        }
      } else {
        // ── Outside a string ─────────────────────────────────────────────

        if (trackValues) {
          // Save vs before any pre-check mutations so the switch can tell
          // whether this char opened InNested (prevVs===AfterColon) or is
          // a deeper nested delimiter (prevVs===InNested).
          const prevVs = vs;

          // Pre-check 1 — finish a literal before its terminating char.
          if (
            vs === VisitState.InLiteral &&
            (c === ',' || c === '}' || c === ']' || c === ' ' || c === '\t' || c === '\n' || c === '\r')
          ) {
            onValue({ i: literalEnd, c: t[literalEnd], t, v: t.slice(valueStart, literalEnd + 1) }, stop);
            vs = VisitState.Idle;
          }

          // Pre-check 2 — detect the first non-whitespace char after ':'.
          if (vs === VisitState.AfterColon && c !== ' ' && c !== '\t' && c !== '\n' && c !== '\r') {
            valueStart = i;
            if (c === '"') {
              vs = VisitState.InString;
            } else if (c === '{' || c === '[') {
              vs = VisitState.InNested;
              valueDepth = 1; // this opening char IS depth 1; not counted again below
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
              // Only start tracking if we are not already inside a value.
              if (vs === VisitState.Idle) vs = VisitState.AfterColon;
              break;
            case '"':
              inString = true;
              onQuote({ i, c, t, side: Side.Left }, stop);
              break;
            case '{':
              // Increment depth only for { that are *inside* an already-tracked
              // nested value (prevVs===InNested).  The very first { that opens
              // the value was handled by Pre-check 2 above (depth already = 1).
              if (prevVs === VisitState.InNested) valueDepth++;
              onBrace({ i, c, t, side: Side.Left }, stop);
              break;
            case '}':
              if (vs === VisitState.InNested) {
                if (--valueDepth === 0) {
                  onValue({ i, c, t, v: t.slice(valueStart, i + 1) }, stop);
                  vs = VisitState.Idle;
                }
              }
              onBrace({ i, c, t, side: Side.Right }, stop);
              break;
            case '[':
              if (prevVs === VisitState.InNested) valueDepth++;
              onBracket({ i, c, t, side: Side.Left }, stop);
              break;
            case ']':
              if (vs === VisitState.InNested) {
                if (--valueDepth === 0) {
                  onValue({ i, c, t, v: t.slice(valueStart, i + 1) }, stop);
                  vs = VisitState.Idle;
                }
              }
              onBracket({ i, c, t, side: Side.Right }, stop);
              break;
            default:
              if (vs === VisitState.InLiteral) literalEnd = i; // keep end cursor current
              onOther({ i, c, t }, stop);
              break;
          }
        } else {
          // ── Fast path: onValue not provided, no tracking overhead ────────
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
      }
      afterChar({ i, c, t }, stop);
    }
    return this;
  }

  /**
   * Reset properties for reusing the instance.
   * - `inString` will be reset to `false` if not provided.
   */
  reset(args: { text?: string; inString?: boolean }): this {
    if ('text' in args) this._t = args.text!;
    this._inString = args.inString ?? false;
    return this;
  }
}

/**
 * @deprecated Use `new MiniWalker(options)` instead.
 */
export const createWalker = (options: Partial<WalkerOptions>) => new MiniWalker(options);
