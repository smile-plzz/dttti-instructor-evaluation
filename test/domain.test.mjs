import { test } from "node:test";
import assert from "node:assert/strict";
import { validRatings, summarize, csvCell } from "../lib/domain.mjs";
test("required ratings reject missing, fractional, out-of-range and wrong-length inputs", () => {
  assert.ok(validRatings([1, 2, 3, 4, 5, null, 3, 2]));
  for (const r of [
    [],
    [1, 2, 3, 4, 5, null, 3, undefined],
    [1, 2, 3, 4, 5, null, 3, 2.5],
    [0, 2, 3, 4, 5, null, 3, 2],
  ])
    assert.equal(validRatings(r), false);
});
test("means exclude N/A and use equal-weight criterion means", () => {
  const s = summarize([
    { ratings: [5, 1, null, null, null, null, null, null] },
    { ratings: [null, 3, null, null, null, null, null, null] },
  ]);
  assert.equal(s.criteria[0].count, 1);
  assert.equal(s.criteria[0].na, 1);
  assert.equal(s.criteria[0].mean, 5);
  assert.equal(s.criteria[1].mean, 2);
  assert.equal(s.overall, 3.5);
  assert.deepEqual(s.criteria[1].distribution, [1, 0, 1, 0, 0]);
  assert.equal(s.criteria[2].mean, null);
  assert.equal(summarize([{ ratings: Array(8).fill(null) }]).overall, null);
});
test("CSV guards spreadsheet formula injection and quotes", () => {
  assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(csvCell("Normal, text"), '"Normal, text"');
  assert.equal(csvCell("  @SUM(1)"), '"\'  @SUM(1)"');
});
