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

const collectCanvasNodes = (node, acc = []) => {
  if (Array.isArray(node)) {
    for (const n of node) collectCanvasNodes(n, acc);
  } else if (node && typeof node === "object") {
    if (node.canvas) acc.push(node);
    if (node.stack) collectCanvasNodes(node.stack, acc);
  }
  return acc;
};

test("buildContractDoc: divider nodes are unique references (pdfmake mutates in place)", () => {
  // Regression: a shared module-level divider object embedded multiple times / across
  // renders caused pdfmake to throw "otherArray.forEach is not a function" on reuse.
  const within = collectCanvasNodes(buildContractDoc(baseData()).content);
  assert.ok(within.length >= 3, "expected at least 3 divider nodes");
  assert.equal(new Set(within).size, within.length, "dividers within one doc must be distinct");

  const second = collectCanvasNodes(buildContractDoc(baseData()).content);
  for (const a of within) {
    for (const b of second) assert.notEqual(a, b, "dividers must not be shared across renders");
  }
});

test("buildContractDoc: embeds owner signature image when supplied", () => {
  const dataUrl = "data:image/png;base64,AAAA";
  const s = JSON.stringify(
    buildContractDoc(baseData({ label: { name: "Recursive Recordings", owner: "Le Gia Huy", email: "x@y.com", signatureImage: dataUrl } })),
  );
  assert.match(s, /data:image\/png;base64,AAAA/);
});

const signatureRows = (doc) => doc.content.filter((c) => c && c.unbreakable && Array.isArray(c.columns));

test("buildContractDoc: signatures render as a two-column grid (owner + first artist side by side)", () => {
  const rows = signatureRows(buildContractDoc(baseData({ artists: [artist()] })));
  assert.equal(rows.length, 1, "owner + 1 artist should be a single row");
  assert.equal(rows[0].columns.length, 2, "each signature row has two columns");
  // owner (left) carries the label owner name; artist (right) carries the alias
  const s = JSON.stringify(rows[0]);
  assert.match(s, /Le Gia Huy/);
  assert.match(s, /Lizzi/);
});

test("buildContractDoc: extra artists wrap into additional two-column rows", () => {
  const rows = signatureRows(
    buildContractDoc(baseData({ artists: [artist(), artist({ alias: "Coco" }), artist({ alias: "Dee" })] })),
  );
  // 1 owner + 3 artists = 4 cells => 2 rows of 2 columns each
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.columns.length), [2, 2]);
});

test("buildContractDoc: each signature row is unbreakable so a block never splits across pages", () => {
  const rows = signatureRows(buildContractDoc(baseData({ artists: [artist(), artist({ alias: "Coco" })] })));
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => r.unbreakable === true));
});

// Recursively collect every { text } string in a pdfmake content tree.
const collectText = (node, out = []) => {
  if (node == null) return out;
  if (Array.isArray(node)) { node.forEach((n) => collectText(n, out)); return out; }
  if (typeof node === "object") {
    if (typeof node.text === "string") out.push(node.text);
    for (const k of ["stack", "columns", "content"]) if (node[k]) collectText(node[k], out);
  }
  return out;
};

const sampleData = {
  label: { name: "Recursive Recordings", owner: "Le Gia Huy", email: "x@x.com" },
  trackTitle: "Nightdrive",
  effectiveDate: "2026-08-05",
  expectedReleaseDate: "2026-09-01",
  artists: [
    { alias: "ALVA", legalName: "Alva One", nationality: "US", email: "a@x.com", splitPercent: 50 },
    { alias: "BEX", legalName: "Bex Two", nationality: "UK", email: "b@x.com", splitPercent: 50 },
  ],
};

test("signingTags emits one signature tag per artist with 1-based signer index", () => {
  const doc = buildContractDoc(sampleData, { signingTags: true });
  const texts = collectText(doc.content);
  assert.ok(texts.includes("{{sign|1|*|Signature|artist_1}}"), "artist 1 tag present");
  assert.ok(texts.includes("{{sign|2|*|Signature|artist_2}}"), "artist 2 tag present");
});

test("signingTags does NOT tag the owner block", () => {
  const doc = buildContractDoc(sampleData, { signingTags: true });
  const texts = collectText(doc.content);
  const ownerTag = texts.filter((t) => t.startsWith("{{sign|0")); // owner would be index 0
  assert.equal(ownerTag.length, 0);
});

test("default (no options) output contains no BoldSign tags", () => {
  const doc = buildContractDoc(sampleData);
  const texts = collectText(doc.content);
  assert.equal(texts.filter((t) => t.includes("{{sign|")).length, 0);
});
