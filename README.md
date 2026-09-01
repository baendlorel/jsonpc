<div align="center">

<img style="display:block;margin:auto" src="./assets/jsonpc.png" alt="jsonpc logo" width="480"/>


**JSON with Property Comments** — A lightweight JSON variant that allows single-line comments `//` and trailing commas in JSON files.
  
[![npm version](
https://img.shields.io/npm/v/jsonpc-ts.svg)](https://www.npmjs.com/package/jsonpc-ts) [![npm downloads](http://img.shields.io/npm/dm/jsonpc-ts.svg)](https://npmcharts.com/compare/jsonpc-ts,token-types?start=1200&interval=30)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Codacy Badge](https://api.codacy.com/project/badge/Grade/59dd6795e61949fb97066ca52e6097ef)](https://www.codacy.com/app/Borewit/jsonpc-ts?utm_source=github.com&utm_medium=referral&utm_content=Borewit/jsonpc-ts&utm_campaign=Badge_Grade)

</div>


## Syntax

**jsonpc** follows these rules for comment:

1. Trailing commas in arrays and objects are allowed
2. Only single-line comments starting with `//` are supported
3. Comments must occupy an entire line
4. Multiple consecutive comment lines are allowed
5. Valid comment positions:
   1. Top of the file (before any JSON content)
   2. Bottom of the file (after all JSON content)
   3. Above property names

_Other positions and block comments are not allowed._

### Examples

```jsonc
// ✅ Valid: Top-level file comment
// ✅ Valid: Multiple consecutive comments allowed
{
  // ✅ Valid: Comment above property name
  "name": "Alice",

  // ✅ Valid: Comment above array element (primitive)
  "items": [
    // ❌ Invalid: Comment not above a property
    1,
    2,
  ],

  "users": [
    {
    // ✅ Valid: Comment above object property in array
    // ✅ Valid: 1 Multiple consecutive comments allowed
    // ✅ Valid: 2 Multiple consecutive comments allowed
      "name": "Bob"
    },
    // ❌ Invalid: Comment not above a property
    "sdaf"
  ],

  /* ❌ Invalid: Block comments not supported */
  "key": "value",
  // ❌ Invalid: Comment not above a property
}
// ✅ Valid: Bottom-level file comment
```

### Parse and Read Values with Comments

```ts
import { parse } from 'jsonpc-ts';

// Parse jsonpc text into an operatable instance
const jsonpc = parse(text);

// Get both value and comments for a property path
const entry = jsonpc.get('profile');
// → { value: { age: 25 }, comments: ['// Nested object comment'] }

// Get value only
const name = jsonpc.get('name')?.value;    // → "Alice"
const age = jsonpc.get('profile.age')?.value; // → 25
const age2 = jsonpc.get(['profile','age'])?.value; // → 25

// Get comments only
const comments = jsonpc.get('name')?.comments;
// → ['// This is a name comment']

// Handle non-existent paths
const entry = jsonpc.get('nonexistent');
// → undefined
```

### Set Values and Comments

```ts
import { parse } from 'jsonpc-ts';

const jsonpc = parse(text);

// Set value only
jsonpc.set('profile.age', { value: 26 });

// Set comments only
jsonpc.set('name', { comments: ['// Updated name comment'] });

// Set both value and comments
jsonpc.set('profile', {
  value: { age: 26 },
  comments: ['// Updated profile comment']
});

// Remove comments by setting empty array
jsonpc.set('name', { comments: [] });
```

### Top and Bottom File Comments

```ts
import { parse } from 'jsonpc-ts';

const jsonpc = parse(text);

// Get top-level file comments
const topComments = jsonpc.top;
// → ['// This is a top comment', '// Another top comment']

// Get bottom-level file comments  
const bottomComments = jsonpc.bottom;
// → ['// This is a bottom comment']

// Set top-level comments
jsonpc.top = ['// New top comment'];

// Set bottom-level comments
jsonpc.bottom = ['// New bottom comment'];
```

### Serialization

```ts
import { parse } from 'jsonpc-ts';

const jsonpc = parse(text);

// Serialize back to JSON text with comments
const output = jsonpc.stringify();

// Custom indentation and replacer
const custom = jsonpc.stringify(null, 4);

// Get clean JSON object without comments
const clean = jsonpc.toObject();
// → { name: "Alice", profile: { age: 25 }, items: [1, 2] }
```

### Cleanup

```ts
// Release internal references and clear internal containers
jsonpc.destroy();
```

### Using with JSON.parse reviver

```ts
import { parse } from 'jsonpc-ts';

// Parse with custom reviver function
const jsonpc = parse(text, (key, value) => {
  // Transform values during parsing
  if (key === 'date' && typeof value === 'string') {
    return new Date(value);
  }
  return value;
});
```

## API Reference

### `parse(text, reviver?)`

Factory function to create a `JSONPC` instance.

**Parameters:**
- `text` (string): Raw JSON text with property comments
- `reviver` (function, optional): Same as the reviver in `JSON.parse`

**Returns:** `JSONPC` instance

### `class JSONPC`

#### Properties

| Property | Type       | Description                        |
| -------- | ---------- | ---------------------------------- |
| `top`    | `string[]` | Get/set top-level file comments    |
| `bottom` | `string[]` | Get/set bottom-level file comments |

#### Methods

##### `get(propPath): Entry | undefined`

Get entry with value and comments for a property path.

**Parameters:**
- `propPath` (string | string[]): Property path (e.g., `"profile.age"` or `["profile", "age"]`)

**Returns:** `Entry | undefined` - Entry containing value and comments, or undefined if path doesn't exist

##### `set(propPath, entry): this`

Set value and/or comments for a property path.

**Parameters:**
- `propPath` (string | string[]): Property path to modify
- `entry` (Partial<Entry>): Object with optional `value` and/or `comments` properties

**Returns:** `this` - Returns the JSONPC instance for chaining

**Note:** Set `entry.comments` to `[]` to remove comments from a property.

##### `stringify(replacer?, space?): string`

Serialize the data back to JSON text with comments.

**Parameters:**
- `replacer` (function | array | null, optional): Same as the replacer in `JSON.stringify`
- `space` (number | string, optional): Default is 2 - Indentation spacing

**Returns:** `string` - JSON text with comments

##### `toObject<T>(): T`

Return a pure JavaScript object without any comment artifacts.

**Returns:** `T` - Clean JavaScript object

##### `destroy(): void`

Release internal references and clear internal containers.

### Type Definitions

```typescript
interface Entry {
  value: any;
  comments?: string[];
}
```

### Property Path Format

Use dot-separated path strings or string arrays to access nested properties:

```ts
"objectName"          // Top-level property
"nested.prop"         // Nested property
"items.0"             // Array element by index
"users.1.name"        // Object property in nested array

// Or use array syntax (equivalent to above)
['users', 1, 'name']  // Same as "users.1.name"
```

## Comparison with Alternatives

| Solution   | Custom Parser | Arbitrary Position Comments | Trailing Commas | Size   |
| ---------- | ------------- | --------------------------- | --------------- | ------ |
| **jsonpc** | ❌            | ❌                          | ✅              | Small  |
| json5      | ✅            | ✅                          | ✅              | Large  |
| JSONC      | ✅            | ✅                          | ❌              | Medium |

jsonpc trades some flexibility for simplicity and performance by:
- Only allowing comments at specific, predictable positions (above properties)
- Using standard JSON parsing with comment pre-processing
- Maintaining a lightweight codebase

## License

[MIT](LICENSE)

## Contributing

Issues and Pull Requests are welcome!

## Related Links

- [GitHub Repository](https://github.com/baendlorel/jsonpc)
- [npm Package](https://www.npmjs.org/package/jsonpc-ts)
