import { _noop } from './common.js';

interface WalkerHandlerArgs {
  index: number;
}

interface WalkerHandlerArgsWithSides extends WalkerHandlerArgs {
  side: 'left' | 'right';
}

/**
 * Only triggred on chars that are not inside a string.
 */
interface WalkerHandlers {
  onComma: (args: WalkerHandlerArgs) => void;
  onColon: (args: WalkerHandlerArgs) => void;
  onQuote: (args: WalkerHandlerArgsWithSides) => void;
  onBrace: (args: WalkerHandlerArgsWithSides) => void;
  onBracket: (args: WalkerHandlerArgsWithSides) => void;

  /**
   * Triggers when char is not something above.
   */
  onOther: (args: WalkerHandlerArgs) => void;

  /**
   * Triggers when char is not something above, and is not whitespace.
   */
  afterChar: (args: WalkerHandlerArgs) => void;
}

export function walk(text: string, handlers: Partial<WalkerHandlers>) {
  const {
    onComma = _noop,
    onColon = _noop,
    onQuote = _noop,
    onBrace = _noop,
    onBracket = _noop,
    onOther = _noop,
    afterChar = _noop,
  } = handlers;

  const len = text.length;
  let inString = false;
  let escaped = false;
}
