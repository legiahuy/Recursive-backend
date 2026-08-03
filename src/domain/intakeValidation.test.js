import { test } from "node:test";
import assert from "node:assert/strict";
import { validateIntake } from "./intakeValidation.js";

test("valid solo submission (no collaborators)", () => {
  const r = validateIntake({ track_title: "Nightfall", collaborators: [] }, {});
  assert.equal(r.valid, true);
  assert.deepEqual(r.errors, []);
  assert.equal(r.normalized.trackTitle, "Nightfall");
  assert.deepEqual(r.normalized.collaborators, []);
});

test("valid multi-collaborator submission trims values", () => {
  const r = validateIntake(
    { track_title: "  Skyline  ", collaborators: [{ name: " Ana ", email: "ANA@x.com" }] },
    {},
  );
  assert.equal(r.valid, true);
  assert.equal(r.normalized.trackTitle, "Skyline");
  assert.deepEqual(r.normalized.collaborators, [{ name: "Ana", email: "ana@x.com" }]);
});

test("missing track title fails", () => {
  const r = validateIntake({ track_title: "   ", collaborators: [] }, {});
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes("track_title")));
});

test("collaborator missing name fails", () => {
  const r = validateIntake(
    { track_title: "T", collaborators: [{ name: "", email: "a@x.com" }] },
    {},
  );
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes("name")));
});

test("collaborator invalid email fails", () => {
  const r = validateIntake(
    { track_title: "T", collaborators: [{ name: "Ana", email: "not-an-email" }] },
    {},
  );
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes("email")));
});

test("intra-submission duplicate emails are deduped (first wins)", () => {
  const r = validateIntake(
    {
      track_title: "T",
      collaborators: [
        { name: "Ana", email: "dup@x.com" },
        { name: "Ana Two", email: "DUP@x.com" },
      ],
    },
    {},
  );
  assert.equal(r.valid, true);
  assert.equal(r.normalized.collaborators.length, 1);
  assert.equal(r.normalized.collaborators[0].name, "Ana");
});

test("collaborator matching an existing (primary) email is dropped", () => {
  const r = validateIntake(
    { track_title: "T", collaborators: [{ name: "Me", email: "primary@x.com" }] },
    { existingEmails: ["Primary@x.com"] },
  );
  assert.equal(r.valid, true);
  assert.deepEqual(r.normalized.collaborators, []);
});
