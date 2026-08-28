# json-property-comment

A lightweight JSON variant that allows `//` line comments **directly above property names**.

This is not a general-purpose JSON-with-comments parser. Comments are only valid in specific positions — primarily right above a property key. This constraint makes the format parseable without a custom lexer: comments are converted into synthetic `_comments` properties, and the result is parsed by the native `JSON.parse`.

## Motivation

JSON is great for data exchange, but the lack of comments makes it painful for hand-written configuration files. Existing solutions either:

- Use a separate preprocessor (strip comments before parsing), losing the ability to round-trip comments
- Introduce a completely different syntax (YAML, TOML, etc.)

`json-property-comment` takes a different approach: comments are **first-class metadata** attached to specific properties. You can read, write, and round-trip them alongside the data.

## Install

```bash
npm install json-property-comment
```

## Usage

### Parse a JSON-with-comments string

```ts
import { JSONWithPropertyComment } from 'json-property-comment';

const text = `
// File-level header comment
{
  // Description of the "name" field
  "name": "example",

  // Nested object comment
  "nested": {
    "key": 1
  }
}
// File-level footer comment
`;

const jpc = new JSONWithPropertyComment(text);
```

### Read / write comments

```ts
// Get comments for a property path
const comments = jpc.getComments('nested');
// → ['// Nested object comment']

// Set comments for a property
jpc.setComments('name', ['// Updated name comment']);

// Get/set values
const name = jpc.get('name');
jpc.set('nested.key', 42);
```

### Serialize back to text with comments

```ts
const output = jpc.stringify();
// Returns the full JSON text with comments preserved
```

### Get a clean JSON object (comments stripped)

```ts
const clean = jpc.toJSON();
// Returns a plain JS object with original property names, no comment artifacts
```

## Notes

- Only `//` line comments are supported. Block comments (`/* */`) are **not** supported.
- Comments must occupy an **entire line** directly above a property name.
- Comments at the very top or bottom of the file are treated as file-level comments.
- This library focuses on JSON **structure and values**. The `stringify()` output will **not** preserve the original formatting (indentation, blank lines). It outputs a consistently formatted result.
- Trailing commas are **not** supported — the input must be valid JSON (with comments stripped).

## API

### `class JSONWithPropertyComment`

| Method | Description |
|---|---|
| `constructor(text: string)` | Parse a JSON-with-comments string |
| `getComments(propPath: string): string[] \| undefined` | Get comments for a property path (dot-separated) |
| `setComments(propPath: string, comments: string[])` | Set comments for a property path |
| `get(propPath: string, defaultValue?: any): any` | Get a value by property path |
| `set(propPath: string, value: any)` | Set a value by property path |
| `stringify(replacer?, space?): string` | Serialize back to JSON text with comments |
| `toJSON<T>(): T` | Return a clean JS object with original property names |
| `toJSONString(...args): string` | Shortcut for `JSON.stringify(this.toJSON(), ...)` |

### Core functions (also exported from `core.ts`)

- `normalizeLines(text)`
- `isComment(line)`
- `stripTopBottom(lines)`
- `aggregateComments(lines)`
- `interpretName(line)`
- `uuidName(origin)`
- `convertCommentsToProperties(compressed)`
- `visit(obj, names, path?, map?)`

## License

MIT
