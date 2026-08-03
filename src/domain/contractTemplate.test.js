import { test } from "node:test";
import assert from "node:assert/strict";
import { buildContractDoc, summarizeRoyalty } from "./contractTemplate.js";

const artist = (over = {}) => ({
  alias: "Lizzi",
  legalName: "Elizabeth Doe",
  nationality: "France",
  email: "lizzi@example.com",
  splitPercent: 100,
  ...over,
});

const baseData = (over = {}) => ({
  label: { name: "Recursive Recordings", owner: "Le Gia Huy", email: "contact@recursiverecordings.com" },
  trackTitle: "Nightfall",
  effectiveDate: "2026-08-04",
  expectedReleaseDate: "2026-09-01",
  artists: [artist()],
  ...over,
});

test("summarizeRoyalty: label always 50, solo artist (100%) balanced, master share halved", () => {
  const r = summarizeRoyalty([artist({ splitPercent: 100 })]);
  assert.equal(r.labelPercent, 50);
  assert.equal(r.artistsTotal, 100);
  assert.equal(r.balanced, true);
  assert.deepEqual(r.artistRows, [{ alias: "Lizzi", share: 100, percent: 50 }]);
});

test("summarizeRoyalty: balanced multi-artist splits the 50% pool proportionally", () => {
  const r = summarizeRoyalty([artist({ splitPercent: 60 }), artist({ alias: "Coco", splitPercent: 40 })]);
  assert.equal(r.artistsTotal, 100);
  assert.equal(r.balanced, true);
  assert.deepEqual(r.artistRows, [
    { alias: "Lizzi", share: 60, percent: 30 },
    { alias: "Coco", share: 40, percent: 20 },
  ]);
});

test("summarizeRoyalty: unbalanced when artist splits don't sum to 100", () => {
  const r = summarizeRoyalty([artist({ splitPercent: 30 }), artist({ alias: "Coco", splitPercent: 30 })]);
  assert.equal(r.artistsTotal, 60);
  assert.equal(r.balanced, false);
});

test("summarizeRoyalty: coerces non-numeric split to 0", () => {
  const r = summarizeRoyalty([artist({ splitPercent: undefined }), artist({ alias: "X", splitPercent: "25" })]);
  assert.equal(r.artistsTotal, 25);
});

test("buildContractDoc: returns a docDefinition with a content array", () => {
  const doc = buildContractDoc(baseData());
  assert.ok(doc && typeof doc === "object");
  assert.ok(Array.isArray(doc.content));
  assert.equal(doc.defaultStyle.font, "Roboto");
});

test("buildContractDoc: interpolates track title + human effective date", () => {
  const s = JSON.stringify(buildContractDoc(baseData()));
  assert.match(s, /Nightfall/);
  assert.match(s, /August 4, 2026/); // effective date, human-readable
  assert.match(s, /September 1, 2026/); // expected release date, human-readable
});

test("buildContractDoc: includes the verbatim legal headings", () => {
  const s = JSON.stringify(buildContractDoc(baseData()));
  for (const h of ["TERRITORY", "LICENSE PERIOD", "GRANT OF RIGHTS", "ROYALTIES",
    "ACCOUNTING", "TRADE-MARKS", "REPRESENTATIONS AND WARRANTIES", "SELL OFF PERIOD",
    "DEFINITIONS", "GENERAL TERMS"]) {
    assert.match(s, new RegExp(h));
  }
});

test("buildContractDoc: multi-artist produces a party block + signature per artist", () => {
  const doc = buildContractDoc(baseData({
    artists: [
      artist({ splitPercent: 25 }),
      artist({ alias: "Coco", legalName: "Colette Roy", email: "coco@example.com", splitPercent: 25 }),
    ],
  }));
  const s = JSON.stringify(doc);
  assert.match(s, /Lizzi/);
  assert.match(s, /Coco/);
  assert.match(s, /Colette Roy/);
});

test("buildContractDoc: label royalty row is always 50 even when artist split differs", () => {
  const s = JSON.stringify(buildContractDoc(baseData({ artists: [artist({ splitPercent: 10 })] })));
  assert.match(s, /Recursive Recordings[\s\S]*?50 %/);
});

test("buildContractDoc: unbalanced splits add a warning note", () => {
  const s = JSON.stringify(buildContractDoc(baseData({ artists: [artist({ splitPercent: 10 })] })));
  assert.match(s, /Artist splits total 10%/i);
});

test("buildContractDoc: balanced splits do NOT add the warning note", () => {
  const s = JSON.stringify(buildContractDoc(baseData({ artists: [artist({ splitPercent: 100 })] })));
  assert.doesNotMatch(s, /Artist splits total/i);
});

test("buildContractDoc: handles a missing expected release date without throwing", () => {
  const doc = buildContractDoc(baseData({ expectedReleaseDate: null }));
  assert.ok(Array.isArray(doc.content));
  assert.match(JSON.stringify(doc), /to be confirmed/);
});

test("buildContractDoc: missing artist fields render an em dash, not undefined", () => {
  const doc = buildContractDoc(baseData({ artists: [{ splitPercent: 50 }] }));
  const s = JSON.stringify(doc);
  assert.doesNotMatch(s, /undefined/);
  assert.match(s, /—/);
});

test("buildContractDoc: calendar-invalid effectiveDate never prints 'undefined'", () => {
  const s = JSON.stringify(buildContractDoc(baseData({ effectiveDate: "2026-13-45" })));
  assert.doesNotMatch(s, /undefined/);
});

test("buildContractDoc: is deterministic (no Date.now inside)", () => {
  const a = JSON.stringify(buildContractDoc(baseData()));
  const b = JSON.stringify(buildContractDoc(baseData()));
  assert.equal(a, b);
});
