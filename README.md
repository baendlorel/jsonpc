<div align="center">

<img style="display:block;margin:auto" src="./assets/jsonpc.png" alt="jsonpc logo" width="480"/>



  
[![npm version](
https://img.shields.io/npm/v/jsonpc-ts.svg)](https://www.npmjs.com/package/jsonpc-ts) [![npm downloads](http://img.shields.io/npm/dm/jsonpc-ts.svg)](https://npmcharts.com/compare/jsonpc-ts,token-types?start=1200&interval=30)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Codacy Badge](https://api.codacy.com/project/badge/Grade/59dd6795e61949fb97066ca52e6097ef)](https://www.codacy.com/app/Borewit/jsonpc-ts?utm_source=github.com&utm_medium=referral&utm_content=Borewit/jsonpc-ts&utm_campaign=Badge_Grade)

</div>

**JSON with Property Comments** — A lightweight JSON variant that allows single-line comments `//`, trailing commas, and extended literals (`NaN`, `Infinity`, ISO dates, BigInt).

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

On top of standard JSON values, **jsonpc** also accepts four extended literals:
`NaN`, `Infinity` (`+Infinity` / `-Infinity`), bare ISO dates and BigInt values —
see [Extended Values](#extended-values).

The full grammar is specified in [JSONPC_SPEC.md](../JSONPC_SPEC.md).

### Examples

```jsonc
// ✅ Valid: Top-level file comment
// ✅ Valid: Multiple consecutive comments allowed
{
  // ✅ Valid: Comment above property name
  "name": "Alice",

  // ✅ Valid: Comment above property name (the value happens to be an array)
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

### Usage

```ts
import { parse } from 'jsonpc-ts';

// Parse jsonpc text into an operatable instance
const jsonpc = parse(text);

// Get both value and comments for a property path
const entry = jsonpc.get('profile');
// → { value: { age: 25 }, comments: ['Nested object comment'] }

// Get value only
const name = jsonpc.get('name')?.value;    // → "Alice"
const age = jsonpc.get('profile.age')?.value; // → 25
const age2 = jsonpc.get(['profile','age'])?.value; // → 25

// Get comments only
const comments = jsonpc.get('name')?.comments;
// → ['This is a name comment']

// Handle non-existent paths
const entry = jsonpc.get('nonexistent');
// → undefined

jsonpc.set('profile', {
  value: { age: 26 },
  comments: ['Updated profile comment']
});
// Sets 'profile' to be an object with age 26 and updates its comments


// Set top-level comments
jsonpc.top = ['New top comment'];

// Set bottom-level comments
jsonpc.bottom = ['New bottom comment'];
```

> Comment strings are stored **without** the `//` prefix. They are prefixed
> automatically when serialized.

### Top and Bottom File Comments

```ts
import { parse } from 'jsonpc-ts';

const jsonpc = parse(text);

// Get top-level file comments
const topComments = jsonpc.top;
// → ['This is a top comment', 'Another top comment']

// Get bottom-level file comments  
const bottomComments = jsonpc.bottom;
// → ['This is a bottom comment']

// Get/Set top-level comments
jsonpc.top = ['New top comment'];

// Get/Set bottom-level comments
jsonpc.bottom = ['New bottom comment'];

// Release internal references and clear internal containers
jsonpc.destroy();
```

### Serialization

```ts
// Serialize back to JSON text with comments
const output = jsonpc.stringify();

// Custom indentation and replacer
const custom = jsonpc.stringify(null, 4);

// Get clean JSON object without comments
const clean = jsonpc.toObject();
// → { name: "Alice", profile: { age: 25 }, items: [1, 2] }
```

## Extended Values

Standard JSON cannot represent `NaN`, `Infinity`, `Date` or `BigInt`. **jsonpc** lets you
write them as bare literals, anywhere a value is allowed (object property
values and array elements):

```jsonc
{
  // Not a number
  "nan": NaN,

  // Infinity, with an optional sign
  "max": Infinity,
  "min": -Infinity,

  // Date, written exactly like Date#toISOString()
  "createdAt": 2024-01-02T03:04:05.678Z,

  // BigInt, with the `n` suffix
  "id": 9007199254740993n,

  "offsets": [NaN, -7n],
}
```

| Literal                    | Resulting JS value |
| -------------------------- | ------------------ |
| `NaN`                      | `NaN`              |
| `Infinity` / `+Infinity`   | `Infinity`         |
| `-Infinity`                | `-Infinity`        |
| `YYYY-MM-DDTHH:mm:ss.sssZ` | `Date`             |
| `-?<digits>n`              | `BigInt`           |

Parsing, serialization and `toObject()` all preserve these values:

```ts
import { parse } from 'jsonpc-ts';

const jsonpc = parse(text);

jsonpc.get('nan')?.value;       // → NaN
jsonpc.get('createdAt')?.value; // → Date instance
jsonpc.get('id')?.value;        // → 9007199254740993n

jsonpc.toObject();
// → { nan: NaN, createdAt: Date, id: 9007199254740993n, ... }
```

```ts
// Values set programmatically are written back as bare literals
jsonpc.set('nan', { value: NaN });
jsonpc.set('createdAt', { value: new Date('2024-01-02T03:04:05.678Z') });
jsonpc.set('id', { value: 42n });

jsonpc.stringify();
// {
//   "nan": NaN,
//   "createdAt": 2024-01-02T03:04:05.678Z,
//   "id": 42n,
// }
```

Notes:

- Number literals are case- and spelling-sensitive: `NaN` and
  `Infinity` / `+Infinity` / `-Infinity` only. `inf`, `INF` and `undefined`
  are **not** supported.
- Dates are recognized only in exact `Date#toISOString()` form: 3-digit
  milliseconds and a trailing `Z`. Timezone offsets and 6/9-digit
  microseconds are rejected. Extended years (`+010000-…`, `-000001-…`) are
  accepted.
- Invalid dates are rejected at parse time, including calendar-invalid ones
  such as `2024-02-31T00:00:00.000Z` (which JS would silently roll over) and
  `2024-13-01T00:00:00.000Z`.
- BigInt may be negative (`-42n`). Integers beyond ±2^53 are only exact when
  written with the `n` suffix; without it, precision follows the host
  language's number type.
- Quoted look-alikes are never converted: `"NaN"`, `"Infinity"`, `"42n"` and
  `"2024-01-02T03:04:05.678Z"` remain plain strings.
- A custom `reviver` passed to `parse()` receives already-converted
  `NaN` / `Infinity` / `Date` / `BigInt` values.
- Files using extended literals are **not** valid standard JSON — other
  parsers will reject them. `toObject()` and quoted strings are the
  interop-friendly alternatives.

## Comparison with Alternatives

| Solution   | Custom Parser | Arbitrary Position Comments | Trailing Commas | NaN / Infinity / Date / BigInt | Size   |
| ---------- | ------------- | --------------------------- | --------------- | ------------------------------ | ------ |
| **jsonpc** | ❌             | ❌                           | ✅               | ✅                              | Small  |
| json5      | ✅             | ✅                           | ✅               | Partial (`NaN`, `Infinity`)    | Large  |
| JSONC      | ✅             | ✅                           | ❌               | ❌                              | Medium |

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
