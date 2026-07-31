import { test } from "node:test";
import assert from "node:assert/strict";
import { STAGES, isValidStage, canTransition, nextStage } from "./pipelineStages.js";

test("STAGES has the 9 ordered non-cancelled stages", () => {
  assert.deepEqual(STAGES, [
    "accepted","info_requested","negotiation","contract_sent",
    "signed","artwork","distribution","assets_presave","released",
  ]);
});

test("isValidStage accepts known stages incl. cancelled", () => {
  assert.equal(isValidStage("accepted"), true);
  assert.equal(isValidStage("cancelled"), true);
  assert.equal(isValidStage("bogus"), false);
});

test("canTransition allows forward, back, and cancel from any stage", () => {
  assert.equal(canTransition("accepted", "info_requested"), true);
  assert.equal(canTransition("artwork", "signed"), true); // back
  assert.equal(canTransition("negotiation", "cancelled"), true);
  assert.equal(canTransition("accepted", "accepted"), true); // no-op
});

test("canTransition forbids leaving cancelled and invalid stages", () => {
  assert.equal(canTransition("cancelled", "accepted"), false);
  assert.equal(canTransition("accepted", "bogus"), false);
  assert.equal(canTransition("bogus", "accepted"), false);
});

test("nextStage returns the following stage, null at released", () => {
  assert.equal(nextStage("accepted"), "info_requested");
  assert.equal(nextStage("info_requested"), "negotiation");
  assert.equal(nextStage("released"), null);
});
