import { _noop } from './common.js';

export const isSpace = (t: unknown) => t === ' ' || t === '\t' || t === '\r' || t === '\n';

export const enum Side {
  Left,
  Right,
}

interface WalkerHandlerArgs {
  i: number;
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

  onComma: (args: WalkerHandlerArgs) => void;
  onColon: (args: WalkerHandlerArgs) => void;
  onQuote: (args: WalkerHandlerArgsWithSides) => void;
  onBrace: (args: WalkerHandlerArgsWithSides) => void;
  onBracket: (args: WalkerHandlerArgsWithSides) => void;
  /**
   * Triggers when `inString === true` and char is `\`, which means the next char is escaped.
   */
  onEscape: (args: WalkerHandlerArgs) => void;

  /**
   * Triggers when char is none of above.
   */
  onOther: (args: WalkerHandlerArgs) => void;
  afterChar: (args: WalkerHandlerArgs) => void;
}

export function walk(text: string, handlers: Partial<WalkerOptions>) {
  const {
    start = 0,
    end = text.length,
    onComma = _noop,
    onColon = _noop,
    onQuote = _noop,
    onBrace = _noop,
    onBracket = _noop,
    onEscape = _noop,
    onOther = _noop,
    afterChar = _noop,
  } = handlers;

  let inString = false;

  for (let i = start; i < end; i++) {
    const c = text[i];

    if (c === '\\') {
      onEscape({ i });
      // ! This could only appear inside a string. So inString must be true here.
      i++; // Skip the next character, as it's escaped
    } else if (inString) {
      if (c === '"') {
        inString = false;
        onQuote({ i, side: Side.Right });
      } else {
        onOther({ i });
      }
    } else {
      // Handle characters outside strings
      switch (c) {
        case ',':
          onComma({ i });
          break;
        case ':':
          onColon({ i });
          break;
        case '"':
          inString = true;
          onQuote({ i, side: Side.Left });
          break;
        case '{':
          onBrace({ i, side: Side.Left });
          break;
        case '}':
          onBrace({ i, side: Side.Right });
          break;
        case '[':
          onBracket({ i, side: Side.Left });
          break;
        case ']':
          onBracket({ i, side: Side.Right });
          break;
        default:
          onOther({ i });
          break;
      }
    }
    afterChar({ i });
  }
}
