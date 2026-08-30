import { _noop } from './common.js';

export const isSpace = (t: unknown) => t === ' ' || t === '\t' || t === '\r' || t === '\n';

export const enum Side {
  Left,
  Right,
}

interface WalkerHandlerArgs {
  index: number;
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
   * Triggers when char is none of above.
   */
  onOther: (args: WalkerHandlerArgs) => void;
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
    onOther = _noop,
  } = handlers;

  let inString = false;
  let escaped = false;

  for (let i = start; i < end; i++) {
    const char = text[i];

    // Handle escape sequences
    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    // Handle characters inside strings
    if (inString) {
      if (char === '"') {
        inString = false;
        onQuote({ index: i, side: Side.Right });
      }
      continue;
    }

    // Handle characters outside strings
    switch (char) {
      case ',':
        onComma({ index: i });
        break;
      case ':':
        onColon({ index: i });
        break;
      case '"':
        inString = true;
        onQuote({ index: i, side: Side.Left });
        break;
      case '{':
        onBrace({ index: i, side: Side.Left });
        break;
      case '}':
        onBrace({ index: i, side: Side.Right });
        break;
      case '[':
        onBracket({ index: i, side: Side.Left });
        break;
      case ']':
        onBracket({ index: i, side: Side.Right });
        break;
      default:
        onOther({ index: i });
        break;
    }
  }
}
