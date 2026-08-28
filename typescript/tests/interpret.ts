import {
  aggregateComments,
  convertCommentsToProperties,
  isComment,
  normalizeLines,
  stripTopBottom,
  visit,
} from '../src/core';
const text = `
// Top comment 1
// Top comment 2

{
  // Comment for ddd
  "ddd": 23,
  "nested": {
    // comment for nested.x
    "x": 1
  },
  "arr":[
  { 
      // comment for arr[0].item
      "item":22
  }
  ]
}

// Bottom comment
`;
function main() {
  const lines = normalizeLines(text);
  const withoutComments = lines.filter((v) => !isComment(v));
  const rawJson = withoutComments.join('');
  try {
    JSON.parse(rawJson);
  } catch (e) {
    throw new Error(`Json text being parsed is invalid, ${(e as Error).message}`);
  }

  // & Now the json is some how valid.

  // Fill the whole file level comments
  const stripIndex = stripTopBottom(lines);
  if (!Number.isNaN(stripIndex.bottom)) {
    lines.splice(stripIndex.bottom); //! Must be done first, or indexes will change.
  }
  if (!Number.isNaN(stripIndex.top)) {
    lines.splice(0, stripIndex.top + 1);
  }

  const aggregated = aggregateComments(lines);
  const named = convertCommentsToProperties(aggregated);

  console.log('aggregated:', aggregated);
  // console.log('named.lines:', named.lines);
  // console.log('named.names:', named.unames);
  const map = visit(JSON.parse(named.lines.join('')), named.unames);
  console.log('map:', map);
}
main();
