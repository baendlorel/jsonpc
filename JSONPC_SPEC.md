# JSONPC Syntax Specification

**JSON with Property Comments** — a strict, deliberately small superset of JSON.

This document describes the syntax accepted by the reference implementation
(`jsonpc-ts`). It is written to be portable: any implementation in another
language should accept exactly the same documents and reject the rest.

Design rule: **be strict**. JSONPC adds comments, trailing commas and a small
set of extended literals. It does not add unquoted keys, single quotes, block
comments, timezone offsets, or any other free-form syntax.

---

## 1. Document

A document contains **exactly one** value, optionally surrounded by comments:

```
document        = ws [ comments ] ws value ws [ comments ] ws
```

- Leading comments (`top`) and trailing comments (`bottom`) are optional.
- An empty document, a whitespace-only document, or a comment-only document is
  **invalid**.
- Multiple root values (`{"a":1}{"b":2}`) are **invalid**.
- Encoding is UTF-8. A leading BOM is accepted and ignored.
- `\r\n`, `\r` and `\n` are all accepted as line breaks; tabs and spaces are
  whitespace.

Standard JSON root scalars are allowed:

```jsonc
// comment
"hello"
// comment
```

```jsonc
// comment
42
```

The root may also be `true`, `false`, `null`, an object or an array.
A **bare extension literal** (e.g. `NaN`, `Infinity`, `42n`, an ISO date) as the
whole document is currently **not accepted** by the reference
implementation — see §9.

---

## 2. Comments

Only single-line comments are supported, using `//`.

### 2.1 Form

- `//` must be the **first non-whitespace** content of its line.
  A comment may not follow a value on the same line:
  `{"a": 1} // no` is invalid.
- Everything after `//` to the end of the line is the comment text.
- One optional space directly after `//` is not part of the text:
  `// hello` → `"hello"`, `//hello` → `"hello"`.
  Any further spaces/tabs **are** preserved: `//  two` → `" two"`.
- Trailing whitespace of the line is not part of the text.
- An empty comment `//` yields the empty string `""`.

### 2.2 Positions

Comments are allowed in exactly three positions:

1. **Top of the document**, before the root value.
2. **Bottom of the document**, after the root value.
3. **Directly above a property name**, inside an object.

```jsonc
// top

{
  // above a property name
  "a": 1,

  "nested": {
    // also above a property name, at any depth
    "b": 2
  }
}
// bottom
```

All other positions are **invalid**:

| Position                            | Example                | Valid             |
| ----------------------------------- | ---------------------- | ----------------- |
| Same line after a value             | `{"a": 1} // x`        | ❌                 |
| After `{` on the same line          | `{ // x`               | ❌                 |
| Above an array element              | `[ // x  1 ]`          | ❌                 |
| Inside an empty object/array        | `{ // x }`, `[ // x ]` | ❌                 |
| After the last property, before `}` | `{ "a": 1 // x }`      | ❌                 |
| Block comment                       | `/* x */`              | ❌                 |
| Inside a string                     | `"// not a comment"`   | (it is just text) |

### 2.3 Grouping

Consecutive comment lines form a single group, preserved in order and attached
to the following element (or to `top` / `bottom`) as an array of strings.

```jsonc
// first line
// second line
{
  // prop comment 1
  // prop comment 2
  "a": 1
}
```

Blank lines are plain whitespace and do **not** split a group: `// a`, a blank
line, then `// b` still form one group `["a", "b"]`. All comment lines between
two values in the same container form a single group, regardless of blank
lines between them.

---

## 3. Values

```
value           = object | array | string | number | "true" | "false" | "null" | extension

object          = "{" ws [ member { ws "," ws member } [ ws "," ] ] ws "}"
member          = comments ws string ws ":" ws value

array           = "[" ws [ value { ws "," ws value } [ ws "," ] ] ws "]"
```

- Trailing commas are allowed in **both** objects and arrays.
- A comma without an element (`[,]`, `{"a":1,,}`) is **invalid**.
  (The reference implementation currently accepts `[,]` and `{,}` and treats
  them as empty — this is an implementation artifact and is **not** part of the
  grammar; see §9.)
- Arrays have no comments attached to their elements.

### 3.1 Strings

Standard JSON strings only:

- delimited by double quotes, no single quotes;
- escapes: `\" \\ \/ \b \f \n \r \t \uXXXX`;
- raw control characters are invalid; raw Unicode (including surrogate pairs)
  is allowed.

### 3.2 Numbers

Standard JSON number grammar:

```
number = "-"? ( "0" | [1-9] digit* ) ( "." digit+ )? ( [eE] [+-]? digit+ )?
```

- No leading `+`, no leading zeros (`007`), no hex (`0x10`), no `NaN`/`Infinity`
  spellings other than the extensions in §4.
- `-0` is accepted and parses as negative zero; `stringify` emits `0`.

### 3.3 Literals

`true`, `false`, `null` — lowercase only.

### 3.4 Keys

Object keys must be double-quoted strings. Unquoted keys (`{a:1}`) are
**invalid**. Duplicate keys are allowed; the last occurrence wins.

---

## 4. Extended literals

These are written **bare** (without quotes), wherever a value is allowed inside
an object or an array. Quoted forms (`"NaN"`, `"42n"`, …) are always ordinary
strings.

| Literal                          | Value                        |
| -------------------------------- | ---------------------------- |
| `NaN`                            | not-a-number                 |
| `Infinity` / `+Infinity`         | positive infinity            |
| `-Infinity`                      | negative infinity            |
| `YYYY-MM-DDTHH:mm:ss.sssZ`       | date/time                    |
| `[+-]YYYYYY-MM-DDTHH:mm:ss.sssZ` | date/time with extended year |
| `-?[0-9]+n`                      | arbitrary-precision integer  |

Spellings are case-sensitive. `nan`, `inf`, `INFINITY`, `undefined` are
**invalid**.

### 4.1 Dates

A date literal must be **exactly** what `Date#toISOString()` produces:

- 4-digit year without sign (`0000`–`9999`), or 6-digit year with an explicit
  sign (`+010000`, `-000001`);
- `MM-DD` with 2 digits each;
- `T`;
- `HH:mm:ss.sss` with 2 digits each and **exactly 3** fractional digits;
- trailing `Z`, uppercase.

Accepted: `2024-01-02T03:04:05.678Z`, `+010000-01-01T00:00:00.000Z`,
`-000001-01-01T00:00:00.000Z`.

Rejected: `2024-01-02T03:04:05.678000Z` (6-digit fraction),
`2024-01-02T03:04:05.678+08:00` (offset), `…z` (lowercase), `24:00:00.000`
(does not round-trip).

**Validity is checked.** The literal must denote a real calendar instant; the
implementation parses it and requires the canonical form to be identical to the
source text. Therefore:

- `2024-13-01T00:00:00.000Z` (month 13) → **error**;
- `2024-02-31T00:00:00.000Z` (day does not exist) → **error**, not rolled over;
- `2023-02-29T00:00:00.000Z` (not a leap year) → **error**;
- `-000000-01-01T00:00:00.000Z` → **error**.

Invalid dates must be rejected at parse time. Implementations in other
languages should parse the exact format, reject out-of-range fields, and
compare the re-emitted canonical form to the source.

### 4.2 BigInt

```
bigint = "-"? digit+ "n"
```

- `n` is the arbitrary-precision integer suffix (taken from JavaScript's
  `BigInt`; JSON descends from JavaScript).
- `+42n`, `1.5n`, `1e3n`, `42N` are **invalid**.
- Leading zeros are allowed and normalized (`007n` → `7`); `-0n` → `0`.
- Implementations must use a native or third-party arbitrary-precision integer
  type (`int` in Python, `BigInteger` in Java, `num-bigint` in Rust, …).
  If the host cannot represent the value, parsing **must fail**; silently
  falling back to a floating-point number is not allowed.
- Without the `n` suffix, large integers follow the host's ordinary number
  semantics (in JavaScript, precision is lost beyond ±2⁵³).

### 4.3 Special numbers

- `NaN` is a legal value; comparison semantics (`NaN != NaN`) are defined by
  the host language, not by this specification.
- `Infinity` and `-Infinity` are legal values; `+Infinity` is an accepted
  spelling of `Infinity`.
- `stringify` emits `NaN`, `Infinity` and `-Infinity` for the corresponding
  non-finite numbers.

---

## 5. Canonical serialization

`stringify` produces a document in the following canonical form:

- optional top comments, then the value, then optional bottom comments, one
  per line;
- containers are multi-line; indentation is 2 spaces by default (configurable);
- every member/element is on its own line and is followed by a trailing comma,
  including the last one;
- an empty container is written as `{}` / `[]` (on the same line as its key
  when nested);
- comments are written as `// <text>` directly above the element they belong
  to;
- strings and numbers are written using standard JSON escaping;
- extended values are written as their bare literals.

Example:

```jsonc
// top
{
  // a comment
  "a": 1,
  "b": [
    NaN,
    2024-01-02T03:04:05.678Z,
    42n,
  ],
}
// bottom
```

The canonical output is intended to be re-parseable. Two current exceptions are
listed in §9.

---

## 6. Interoperability

- A document using comments, trailing commas or extended literals is **not**
  valid standard JSON and will be rejected by standard JSON parsers.
- `toObject()` returns ordinary host values, with extensions converted to their
  native equivalents (`NaN`, infinities, date/time objects, big integers).
  Quoting extensions (`"42n"`, `"2024-…Z"`) is the interop-friendly option when
  a plain JSON document is required.
- Unicode escape sequences in keys are decoded; the resulting key is an ordinary
  string.

---

## 7. Semantics defined by the host language

The specification deliberately does not standardize:

- equality/comparison of `NaN` (host rules apply; `NaN != NaN` in
  IEEE-754-based languages);
- object key ordering (in JavaScript, integer-like keys are enumerated first);
- behavior of values outside the representable range of the host number type
  when no `n` suffix is used;
- whether duplicate keys are rejected or last-wins (the reference implementation
  is last-wins).

---

## 8. Not part of the grammar

The following are implementation details and are **not** part of JSONPC:

- the internal tagged-string encoding used by the reference implementation to
  carry extensions through `JSON.parse` (a U+E000-prefixed marker). Other
  implementations should parse directly and never need these tags;
- the naming/format of `top` / `bottom` / per-property comment storage in the
  API;
- the exact indentation width chosen by `stringify`.

---

## 9. Known deviations and limitations of the reference implementation

These are current behaviors, not intended grammar. Do not rely on them, and do
not treat them as normative.

1. **Root extension literals are rejected.** The document `NaN`, `Infinity`,
   `42n` or `2024-01-02T03:04:05.678Z` alone fails, although the same literal is
   accepted inside an object or array. Root standard scalars (`1`, `"x"`,
   `true`, `null`) work.
2. **Empty-container comma artifacts.** `[,]` and `{,}` are accepted and treated
   as empty containers; the grammar in §3 disallows them.
3. **Property names are not escaped when serializing.** A key containing `"`,
   `\` or a control character (valid when written escaped in the source) is
   emitted unescaped, so the output cannot be re-parsed. `toObject()` is
   affected as well, because it serializes internally.
4. **Array element comments.** `stringify` can emit a comment above an array
   element if one was set through the API, but the parser rejects comments in
   that position (§2.2). Such output is not re-parseable. This is tracked as an
   open design item (`TODO(jsonpc#B)` in the source).
