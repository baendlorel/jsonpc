import { _noop } from '../core/common.js';

/**
 * This state is not needed by `Walker` class, but is used by some walkers that are built on top of it.
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
  i: number;
  c: string;
  t: string;
}

export interface WalkerHandlerArgsWithSides extends WalkerHandlerArgs {
  side: Side;
}

/**
 * Only triggred on chars that are not inside a string.
 */
interface WalkerOptions {
  start: number;
  end: number;
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
  onStringContent: (args: WalkerHandlerArgs, stop: () => void) => void;

  /**
   * Triggers when char is none of above.
   */
  onOther: (args: WalkerHandlerArgs, stop: () => void) => void;
  afterChar: (args: WalkerHandlerArgs, stop: () => void) => void;
}

export class Walker {
  text: string;
  start: number;
  end: number;
  inString: boolean;
  onComma: WalkerOptions['onComma'];
  onColon: WalkerOptions['onColon'];
  onQuote: WalkerOptions['onQuote'];
  onBrace: WalkerOptions['onBrace'];
  onBracket: WalkerOptions['onBracket'];
  onEscape: WalkerOptions['onEscape'];
  onStringContent: WalkerOptions['onStringContent'];
  onOther: WalkerOptions['onOther'];
  afterChar: WalkerOptions['afterChar'];

  private stop = () => (this.end = NaN);

  constructor(text: string, handlers: Partial<WalkerOptions>) {
    this.text = text;
    this.start = handlers.start ?? 0;
    this.end = handlers.end ?? text.length;
    this.inString = handlers.inString ?? false;
    this.onComma = handlers.onComma ?? _noop;
    this.onColon = handlers.onColon ?? _noop;
    this.onQuote = handlers.onQuote ?? _noop;
    this.onBrace = handlers.onBrace ?? _noop;
    this.onBracket = handlers.onBracket ?? _noop;
    this.onEscape = handlers.onEscape ?? _noop;
    this.onStringContent = handlers.onStringContent ?? _noop;
    this.onOther = handlers.onOther ?? _noop;
    this.afterChar = handlers.afterChar ?? _noop;
  }

  /**
   * Reset properties for reusing the instance.
   * - `start` and `end` will be reset to 0 and `text.length` if not provided.
   * - `inString` will be reset to `false` if not provided.
   */
  reset(args: { text?: string; start?: number; end?: number; inString?: boolean }): this {
    if ('text' in args) this.text = args.text!;
    this.inString = args.inString ?? false;
    this.start = args.start ?? 0;
    this.end = args.end ?? this.text.length;
    return this;
  }

  run(): this {
    let escaped = false;
    const t = this.text;
    for (let i = this.start; i < this.end; i++) {
      const c = this.text[i];

      if (escaped) {
        escaped = false;
        this.onStringContent({ i, c, t }, this.stop);
      } else if (c === '\\') {
        if (!this.inString) {
          throw new Error(`Unexpected escape character at position ${i} outside of a string.`);
        }
        escaped = true;
        this.onEscape({ i, c, t }, this.stop);
        this.onStringContent({ i, c, t }, this.stop);
      } else if (this.inString) {
        if (c === '"') {
          this.inString = false;
          this.onQuote({ i, c, t, side: Side.Right }, this.stop);
        } else {
          this.onStringContent({ i, c, t }, this.stop);
        }
      } else {
        // Handle characters outside strings
        switch (c) {
          case ',':
            this.onComma({ i, c, t }, this.stop);
            break;
          case ':':
            this.onColon({ i, c, t }, this.stop);
            break;
          case '"':
            this.inString = true;
            this.onQuote({ i, c, t, side: Side.Left }, this.stop);
            break;
          case '{':
            this.onBrace({ i, c, t, side: Side.Left }, this.stop);
            break;
          case '}':
            this.onBrace({ i, c, t, side: Side.Right }, this.stop);
            break;
          case '[':
            this.onBracket({ i, c, t, side: Side.Left }, this.stop);
            break;
          case ']':
            this.onBracket({ i, c, t, side: Side.Right }, this.stop);
            break;
          default:
            this.onOther({ i, c, t }, this.stop);
            break;
        }
      }
      this.afterChar({ i, c, t }, this.stop);
    }

    return this;
  }
}
