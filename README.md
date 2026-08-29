<div align="center">

# jsonpc

**JSON with Property Comments** — A lightweight JSON variant that allows comments in specific positions
  
[![npm version](
https://img.shields.io/npm/v/jsonpc-ts.svg)](https://www.npmjs.com/package/jsonpc-ts) [![npm downloads](http://img.shields.io/npm/dm/jsonpc-ts.svg)](https://npmcharts.com/compare/jsonpc-ts,token-types?start=1200&interval=30)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Codacy Badge](https://api.codacy.com/project/badge/Grade/59dd6795e61949fb97066ca52e6097ef)](https://www.codacy.com/app/Borewit/jsonpc-ts?utm_source=github.com&utm_medium=referral&utm_content=Borewit/jsonpc-ts&utm_campaign=Badge_Grade)

</div>

## Features

✨ **Lightweight** — About 4KB.
🎯 **Specific Positions** — Comments only allowed above property names, keeping it simple and clear.
🔧 **Complete Operations** — Read/set comments and values, array operations supported.  
➕ **Trailing Commas** — Trailing commas are supported.

## Installation

```bash
pnpm add jsonpc-ts
# or
npm install jsonpc-ts
# or
yarn add jsonpc-ts
```

## Quick Start

### Parse JSON with comments

```ts
import { parse } from 'jsonpc-ts';

const text = `
// File-level header comment
// Can have multiple lines

{
  // User name
  "name": "Alice",

  // Nested object comment
  "profile": {
    "age": 25
  },

  // Array comment
  "items": [1, 2, 3,]
}
// File-level footer comment
`;

const jsonpc = parse(text);
```

### Read and set comments

```ts
// Get comments for a property path
const comments = jsonpc.getComments('profile');
// → ['// Nested object comment']

// Set comments for a property
jsonpc.setComments('name', ['// This is a new comment']);
```

### Read and set values

```ts
// Get values
const name = jsonpc.get('name');           // → "Alice"
const age = jsonpc.get('profile.age');     // → 25

// Set values
jsonpc.set('profile.age', 26);

// Get with default value if path doesn't exist
const email = jsonpc.get('email', 'N/A');  // → "N/A"
```

### Array operations

```ts
// All common array methods supported, comments automatically maintained
jsonpc.updateArray('items', 'push', [4]);           // Add element
jsonpc.updateArray('items', 'pop', []);             // Remove last
jsonpc.updateArray('items', 'shift', []);           // Remove first
jsonpc.updateArray('items', 'unshift', [0]);        // Add to beginning
jsonpc.updateArray('items', 'splice', [1, 2, 5, 6]); // Replace elements
jsonpc.updateArray('items', 'sort', [(a, b) => a - b]); // Sort
jsonpc.updateArray('items', 'reverse', []);         // Reverse
```

### Serialization

```ts
// Serialize back to JSON text with comments
const output = jsonpc.stringify();

// Custom indentation and replacer
const custom = jsonpc.stringify(null, 4);

// Get clean JSON object without comments
const clean = jsonpc.toObject();

// Get standard JSON string (no comments)
const jsonString = jsonpc.stringifyWithoutComment(null, 2);
```

## Rules

jsonpc follows these rules for comment support:

### Comment Syntax

1. **Trailing commas supported** — Trailing commas in arrays and objects are allowed
2. **Only `//` comments** — Only single-line comments starting with `//` are supported
3. **Full-line comments** — Comments must occupy an entire line
4. **Multi-line comments** — Multiple consecutive comment lines are allowed, but each must start with `//`

### Valid Comment Positions

Comments are **only** valid in these specific positions:

1. **File-level header** — At the very top of the file (before any JSON content)

2. **File-level footer** — At the very bottom of the file (after all JSON content)

3. **Above property names** — Directly above a property name in an object

4. **Above array members** — Directly above array members:
   - For **primitive types**: The comment represents that array element (`arr[i]`)
   - For **objects**: Comments inside the object represent the property path comments
   - For **top-level arrays**: The first item in the property path is `null` to distinguish from nested arrays

### Examples

```json
{
  // ✅ Valid: Comment above property name
  "name": "Alice",

  // ✅ Valid: Comment above array element (primitive)
  "items": [
    // First item
    1,
    // Second item
    2,
  ],

  // ✅ Valid: Comment above object property in array
  "users": [
    // User name
    {
      "name": "Bob"
    }
  ],

  /* ❌ Invalid: Block comments not supported */
  "key": "value",

  // ❌ Invalid: Comment not above a property
  "key": "value"
  // This comment is invalid

  // ❌ Invalid: Comments in other positions will error
  "nested": {
    "inner": "value"
  }
}
```

### File-level Comments

```ts
// Top-level file with header and footer comments
// Can have multiple lines
{
  "version": "1.0.0"
}
// Footer comment
// Another footer line
```

## API

### `parse(text: string, reviver?): JSONPC`

Parse a JSON string with comments.

```ts
const jsonpc = parse(text, (key, value) => {
  // Optional reviver function, same as JSON.parse
  return value;
});
```

### `class JSONPC`

#### Methods

| Method                                                | Description                                   |
| ----------------------------------------------------- | --------------------------------------------- |
| `getComments(path: string): string[] \| undefined`    | Get comments for a property path              |
| `setComments(path: string, comments: string[]): this` | Set comments for a property path              |
| `get(path: string, defaultValue?: any): any`          | Get a value by property path                  |
| `set(path: string, value: any): this`                 | Set a value by property path                  |
| `updateArray(path, method, args): this`               | Execute array operations                      |
| `stringify(replacer?, space?): string`                | Serialize to JSON text with comments          |
| `toObject<T>(): T`                                    | Return a pure JavaScript object (no comments) |
| `stringifyWithoutComment(...args): string`            | Return standard JSON string (no comments)     |
| `destroy(): void`                                     | Clean up internal references                  |

#### Property Path Format

Use dot-separated path strings:

```ts
"objectName"          // Top-level property
"nested.prop"         // Nested property
"items.0"             // Array element
"users.1.name"        // Object property in nested array
```

#### Supported Array Methods

The `updateArray` method supports these array operations:

- `push` — Add elements to the end
- `pop` — Remove the last element
- `shift` — Remove the first element
- `unshift` — Add elements to the beginning
- `splice` — Insert/delete/replace elements
- `sort` — Sort the array
- `reverse` — Reverse the array

## Design Philosophy

jsonpc achieves lightweight comment support through clever transformation:

1. **Preprocessing** — Extract comments and map them to property paths
2. **Transformation** — Convert comments to temporary `_comment` properties
3. **Parsing** — Parse using native `JSON.parse`
4. **Cleanup** — Remove temporary properties, preserve comment mapping
5. **Serialization** — Reinsert comment mappings into output

This design avoids custom lexers, maintaining code simplicity and performance.

## Complete Example

```ts
import { parse } from 'jsonpc-ts';

// 1. Parse configuration file
const configText = `
// Application configuration
{
  // Server address
  "host": "localhost",
  "port": 3000,

  // Feature flags
  "features": {
    "auth": true,
    "logging": false
  },

  // Allowed domain list
  "allowedDomains": ["example.com", "test.com",]
}
`;

const config = parse(configText);

// 2. Read configuration
const host = config.get('host');              // → "localhost"
const isAuthEnabled = config.get('features.auth'); // → true

// 3. Update configuration
config.set('port', 8080);
config.updateArray('allowedDomains', 'push', ['api.example.com']);

// 4. Update comments
config.setComments('port', ['// Server port (updated)']);

// 5. Serialize and save
console.log(config.stringify());

// 6. Get pure object for application use
const appConfig = config.toObject();
```

## Comparison with Alternatives

| Solution   | Custom Parser | Arbitrary Position Comments | Trailing Commas | Size   |
| ---------- | ------------- | --------------------------- | --------------- | ------ |
| **jsonpc** | ❌             | ❌                           | ✅               | Small  |
| json5      | ✅             | ✅                           | ✅               | Large  |
| JSONC      | ✅             | ✅                           | ❌               | Medium |

jsonpc trades some flexibility for simplicity and performance.

## License

[MIT](LICENSE)

## Contributing

Issues and Pull Requests are welcome!

## Related Links

- [GitHub Repository](https://github.com/baendlorel/jsonpc)
- [npm Package](https://www.npmjs.org/package/jsonpc-ts)
