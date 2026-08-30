<div align="center">

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
