import { _noop } from './common.js';

export const enum Side {
  Left,
  Right,
}

export interface WalkerHandlerArgs {
  i: number;
  c: string;
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

  reset(args: { text?: string; start?: number; end?: number; inString?: boolean }) {
    if ('text' in args) this.text = args.text!;
    if ('start' in args) this.start = args.start!;
    if ('end' in args) this.end = args.end!;
    if ('inString' in args) this.inString = args.inString!;
  }

  run() {
    let escaped = false;
    for (let i = this.start; i < this.end; i++) {
      const c = this.text[i];

      if (escaped) {
        escaped = false;
        this.onStringContent({ i, c }, this.stop);
      } else if (c === '\\') {
        if (!this.inString) {
          throw new Error(`Unexpected escape character at position ${i} outside of a string.`);
        }
        escaped = true;
        this.onEscape({ i, c }, this.stop);
        this.onStringContent({ i, c }, this.stop);
      } else if (this.inString) {
        if (c === '"') {
          this.inString = false;
          this.onQuote({ i, c, side: Side.Right }, this.stop);
        } else {
          this.onStringContent({ i, c }, this.stop);
        }
      } else {
        // Handle characters outside strings
        switch (c) {
          case ',':
            this.onComma({ i, c }, this.stop);
            break;
          case ':':
            this.onColon({ i, c }, this.stop);
            break;
          case '"':
            this.inString = true;
            this.onQuote({ i, c, side: Side.Left }, this.stop);
            break;
          case '{':
            this.onBrace({ i, c, side: Side.Left }, this.stop);
            break;
          case '}':
            this.onBrace({ i, c, side: Side.Right }, this.stop);
            break;
          case '[':
            this.onBracket({ i, c, side: Side.Left }, this.stop);
            break;
          case ']':
            this.onBracket({ i, c, side: Side.Right }, this.stop);
            break;
          default:
            this.onOther({ i, c }, this.stop);
            break;
        }
      }
      this.afterChar({ i, c }, this.stop);
    }
  }
}
