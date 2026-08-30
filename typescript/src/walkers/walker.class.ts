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
}

export const createWorker = ({
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
}: Partial<WalkerOptions>) => {
  let t = '';
  const instance = {
    run(start = 0, end = t.length) {
      let escaped = false;
      const stop = () => (end = NaN);

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
          } else {
            onInString({ i, c, t }, stop);
          }
        } else {
          // Handle characters outside strings
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
      return instance;
    },
    /**
     * Reset properties for reusing the instance.
     * - `start` and `end` will be reset to 0 and `text.length` if not provided.
     * - `inString` will be reset to `false` if not provided.
     */
    reset(args: { text?: string; inString?: boolean }) {
      if ('text' in args) t = args.text!;
      inString = args.inString ?? false;
      return instance;
    },
  };
  return instance;
};
