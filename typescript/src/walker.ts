import { _noop } from './common.js';

export const enum Side {
  Left,
  Right,
}

interface WalkerHandlerArgs {
  i: number;
  c: string;
}

interface WalkerHandlerArgsWithSides extends WalkerHandlerArgs {
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

export function walk(text: string, handlers: Partial<WalkerOptions>) {
  const {
    start = 0,
    onComma = _noop,
    onColon = _noop,
    onQuote = _noop,
    onBrace = _noop,
    onBracket = _noop,
    onEscape = _noop,
    onStringContent = _noop,
    onOther = _noop,
    afterChar = _noop,
  } = handlers;

  let end = handlers.end ?? text.length;
  let inString = handlers.inString ?? false;
  let stop = () => (end = NaN);

  let escaped = false;
  for (let i = start; i < end; i++) {
    const c = text[i];

    if (escaped) {
      escaped = false;
      onStringContent({ i, c }, stop);
    } else if (c === '\\') {
      if (!inString) {
        throw new Error(`Unexpected escape character at position ${i} outside of a string.`);
      }
      escaped = true;
      onEscape({ i, c }, stop);
      onStringContent({ i, c }, stop);
    } else if (inString) {
      if (c === '"') {
        inString = false;
        onQuote({ i, c, side: Side.Right }, stop);
      } else {
        onStringContent({ i, c }, stop);
      }
    } else {
      // Handle characters outside strings
      switch (c) {
        case ',':
          onComma({ i, c }, stop);
          break;
        case ':':
          onColon({ i, c }, stop);
          break;
        case '"':
          inString = true;
          onQuote({ i, c, side: Side.Left }, stop);
          break;
        case '{':
          onBrace({ i, c, side: Side.Left }, stop);
          break;
        case '}':
          onBrace({ i, c, side: Side.Right }, stop);
          break;
        case '[':
          onBracket({ i, c, side: Side.Left }, stop);
          break;
        case ']':
          onBracket({ i, c, side: Side.Right }, stop);
          break;
        default:
          onOther({ i, c }, stop);
          break;
      }
    }
    afterChar({ i, c }, stop);
  }
}
