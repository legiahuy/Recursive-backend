import test from "node:test";
import assert from "node:assert/strict";
import { reduceEsignEvent } from "./esignEvents.js";

test("Completed → document completed, all signers signed", () => {
  const r = reduceEsignEvent("Completed", [
    { email: "a@x.com", status: "Completed" },
    { email: "b@x.com", status: "Completed" },
  ]);
  assert.equal(r.documentStatus, "completed");
  assert.deepEqual(r.signerStatuses, [
    { email: "a@x.com", sign_status: "signed" },
    { email: "b@x.com", sign_status: "signed" },
  ]);
});

test("Signed (partial) → document unchanged, signed signer marked", () => {
  const r = reduceEsignEvent("Signed", [
    { email: "a@x.com", status: "Completed" },
    { email: "b@x.com", status: "InProgress" },
  ]);
  assert.equal(r.documentStatus, null); // not all done yet
  assert.deepEqual(r.signerStatuses, [
    { email: "a@x.com", sign_status: "signed" },
    { email: "b@x.com", sign_status: "pending" },
  ]);
});

test("Declined → document declined and that signer declined", () => {
  const r = reduceEsignEvent("Declined", [{ email: "a@x.com", status: "Declined" }]);
  assert.equal(r.documentStatus, "declined");
  assert.deepEqual(r.signerStatuses, [{ email: "a@x.com", sign_status: "declined" }]);
});

test("Revoked → document voided", () => {
  const r = reduceEsignEvent("Revoked", []);
  assert.equal(r.documentStatus, "voided");
});

test("Expired → document expired", () => {
  const r = reduceEsignEvent("Expired", []);
  assert.equal(r.documentStatus, "expired");
});

test("Sent → document sent", () => {
  const r = reduceEsignEvent("Sent", []);
  assert.equal(r.documentStatus, "sent");
});

test("Unknown event → no document change, no signer change", () => {
  const r = reduceEsignEvent("Viewed", [{ email: "a@x.com", status: "InProgress" }]);
  assert.equal(r.documentStatus, null);
  assert.deepEqual(r.signerStatuses, [{ email: "a@x.com", sign_status: "pending" }]);
});
