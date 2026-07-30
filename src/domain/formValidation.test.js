import { test } from "node:test";
import assert from "node:assert/strict";
import { validateFormSubmission } from "./formValidation.js";

const base = () => ({
  legal_name: "Jane Doe", artist_name: "Jane", country: "US",
  track_title: "Nightfall", genre: "House", explicit: false,
  role: "Producer", split_percent: 100, collaborators: "",
  rights_attestation: true,
  dsp: {
    spotify: { has: true, url: "https://open.spotify.com/artist/x" },
    apple: { has: false, createNew: true },
    soundcloud: { has: true, url: "https://soundcloud.com/jane" },
  },
  instagram: { url: "https://instagram.com/jane" },
  bio: "Producer from NYC.", press_photo_url: "https://cdn/x.jpg",
});

test("a complete valid submission passes", () => {
  assert.deepEqual(validateFormSubmission(base()), { valid: true, errors: [] });
});

test("missing required identity fields fail", () => {
  const d = base(); d.legal_name = "";
  const r = validateFormSubmission(d);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes("legal_name")));
});

test("rights attestation must be true", () => {
  const d = base(); d.rights_attestation = false;
  assert.equal(validateFormSubmission(d).valid, false);
});

test("split_percent out of range fails", () => {
  const d = base(); d.split_percent = 140;
  assert.equal(validateFormSubmission(d).valid, false);
});

test("DSP with has:true but bad url fails", () => {
  const d = base(); d.dsp.spotify = { has: true, url: "not-a-url" };
  assert.equal(validateFormSubmission(d).valid, false);
});

test("DSP with has:false requires createNew", () => {
  const d = base(); d.dsp.apple = { has: false, createNew: false };
  assert.equal(validateFormSubmission(d).valid, false);
});

test("soundcloud cannot be skipped entirely", () => {
  const d = base(); d.dsp.soundcloud = { has: false, createNew: false };
  const r = validateFormSubmission(d);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes("soundcloud")));
});

test("instagram notUsed passes without url", () => {
  const d = base(); d.instagram = { notUsed: true };
  assert.equal(validateFormSubmission(d).valid, true);
});

test("bio and press photo required", () => {
  const d = base(); d.bio = ""; d.press_photo_url = "";
  const r = validateFormSubmission(d);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes("bio")));
  assert.ok(r.errors.some((e) => e.includes("press_photo_url")));
});
