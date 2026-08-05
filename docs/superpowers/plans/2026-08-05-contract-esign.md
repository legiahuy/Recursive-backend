# Contract E-Signature (BoldSign) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the label owner send an already-generated contract PDF to collaborating artist(s) for legally-binding e-signature via BoldSign, track per-signer progress, auto-advance the pipeline stage, and archive the signed PDF — all from the admin pipeline drawer.

**Architecture:** Backend adds an isolated BoldSign client (`esign.service.js`) that builds a text-tagged signing variant of the existing contract PDF, sends it via BoldSign's `/v1/document/send`, and reconciles state from an HMAC-verified webhook using a pure reducer. Owner signature stays pre-embedded (only artists sign). Frontend extends the existing contract UI in `PipelineDetail.tsx` with Send / Resend / Void / Download-signed + per-signer progress.

**Tech Stack:** Node 20 + Express 5 (ESM), `@supabase/supabase-js`, pdfmake 0.3, Node global `fetch` + `crypto` (no new deps); Next.js 16 + axios on the FE.

## Global Constraints

- **Commit identity:** every commit authored `legiahuy <legiahuy51tambinh@gmail.com>` using `git -c user.name="legiahuy" -c user.email="legiahuy51tambinh@gmail.com" commit --no-verify -m "..."`. **NO AI/Copilot co-author trailers, ever.** Verify with `git config user.name` before each commit.
- **Repos:** BE work in `C:\Users\t-huyle\Documents\Recursive\Recursive-backend`; FE work in `C:\Users\t-huyle\Documents\Recursive\Recursive-Web`. They are separate git repos; commit/push independently.
- **No new backend dependencies** — use Node's built-in `fetch`, `FormData`/`Blob`, and `crypto`.
- **BoldSign REST:** base `https://api.boldsign.com`, auth header `X-API-KEY: <key>`. Base URL comes from `BOLDSIGN_BASE_URL` (default `https://api.boldsign.com`); key from `BOLDSIGN_API_KEY`; webhook secret from `BOLDSIGN_WEBHOOK_SECRET`.
- **Owner never signs via BoldSign** — signature pre-embedded; only artists are signers.
- **Multi-artist = parallel** signing (`EnableSigningOrder=false`).
- **Text tags:** syntax `{{sign|<signerIndex>|*|<label>|<fieldId>}}`, `signerIndex` is 1-based and maps to the `Signers` array order; render tags white (`#FFFFFF`) so they're invisible; send with `UseTextTags=true`.
- **Stage automation:** send → `contract_sent`; all-signed (`Completed`) → `signed`. Valid stages live in `src/domain/pipelineStages.js`.
- **Secrets:** never commit API keys/secrets; they are Render env vars only.
- **BE tests:** `npm test` runs `node --test src/domain/**/*.test.js`. Pure logic lives in `src/domain/` so it is auto-tested. Syntax-check services with `node --check <file>`.
- **FE gates:** `pnpm lint` and `pnpm build` must stay green. No public-page Hallmark mockup needed (internal admin UI extending an existing component).

---

## File Structure

**Backend (`Recursive-backend`):**
- Create `migrations/add_esign_columns.sql` — additive columns.
- Modify `src/domain/contractTemplate.js` — add `signingTags` option that emits per-artist text tags.
- Modify `src/domain/contractTemplate.test.js` — tests for the signing variant.
- Create `src/domain/esignEvents.js` — pure webhook→state reducer.
- Create `src/domain/esignEvents.test.js` — reducer tests.
- Create `src/services/esign.service.js` — BoldSign HTTP client + orchestration (send/remind/void/getSignedUrl/handleWebhook).
- Modify `src/controllers/pipeline.controller.js` — 4 admin handlers + 1 webhook handler.
- Modify `src/routes/pipeline.routes.js` — 4 admin routes.
- Create `src/routes/webhooks.routes.js` — public webhook router.
- Modify `src/app.js` — capture raw body in `express.json`; mount webhook router.
- Modify `.env.example` (create if missing) — document new env vars.

**Frontend (`Recursive-Web`):**
- Modify `services/pipelineService.ts` — esign fields on `PipelineItem`/`PipelineCollaborator` + 4 methods.
- Modify `components/admin/pipeline/PipelineDetail.tsx` — signature status panel + handlers.

---

## Task 1: Database migration + shared field shapes

**Files:**
- Create: `Recursive-backend/migrations/add_esign_columns.sql`

**Interfaces:**
- Produces: new columns read/written by later tasks — `pipeline_items.esign_document_id` (text), `esign_status` (text, default `none`), `esign_sent_at` (timestamptz), `esign_completed_at` (timestamptz), `signed_pdf_path` (text); `pipeline_collaborators.sign_status` (text), `signed_at` (timestamptz), `esign_signer_id` (text).

- [ ] **Step 1: Write the migration**

```sql
-- Contract e-signature (BoldSign): envelope-level state on the card + per-signer state.
ALTER TABLE pipeline_items
  ADD COLUMN IF NOT EXISTS esign_document_id TEXT,
  ADD COLUMN IF NOT EXISTS esign_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS esign_sent_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS esign_completed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS signed_pdf_path TEXT;

ALTER TABLE pipeline_collaborators
  ADD COLUMN IF NOT EXISTS sign_status TEXT,
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS esign_signer_id TEXT;

-- esign_status domain: none | sent | completed | declined | voided | expired
-- sign_status domain:  (null until sent) | pending | signed | declined
```

- [ ] **Step 2: Verify the SQL parses**

Run: `Get-Content migrations/add_esign_columns.sql` (visual review — must be idempotent `IF NOT EXISTS`, no destructive statements).
Expected: only additive `ADD COLUMN IF NOT EXISTS`.

- [ ] **Step 3: Commit**

```bash
git -c user.name="legiahuy" -c user.email="legiahuy51tambinh@gmail.com" commit --no-verify -m "Add e-signature columns migration" -- migrations/add_esign_columns.sql
```

> **Note:** The migration is applied manually against Supabase at rollout (Task 10), not by code.

---

## Task 2: Text-tag signing variant of the contract PDF

**Files:**
- Modify: `Recursive-backend/src/domain/contractTemplate.js`
- Test: `Recursive-backend/src/domain/contractTemplate.test.js`

**Interfaces:**
- Consumes: existing `buildContractDoc(data)` and `signatureBlock(title, name, signatureImage)`.
- Produces: `buildContractDoc(data, { signingTags = false } = {})`. When `signingTags` is true, each artist signature block renders an invisible BoldSign tag `{{sign|<i>|*|Signature|artist_<i>}}` (i = 1-based artist order) in place of the blank signing line; the owner block is unchanged (no tag). Default (no options) output is byte-for-byte the current unsigned draft.

- [ ] **Step 1: Write the failing tests**

Add to `src/domain/contractTemplate.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { buildContractDoc } from "./contractTemplate.js";

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test src/domain/contractTemplate.test.js`
Expected: FAIL — `buildContractDoc` ignores the second argument, so tag strings are absent.

- [ ] **Step 3: Implement the signing variant**

In `src/domain/contractTemplate.js`, change `signatureBlock` to accept an optional `signingTagIndex` and, when present, render the invisible tag as the signing space:

```js
const signatureBlock = (title, name, signatureImage, signingTagIndex) => {
  // Priority: embedded owner image > invisible e-sign tag > blank manual space.
  let signingSpace;
  if (signatureImage) {
    signingSpace = { image: signatureImage, width: SIGN_WIDTH, margin: [0, 8, 0, 2] };
  } else if (signingTagIndex) {
    signingSpace = {
      text: `{{sign|${signingTagIndex}|*|Signature|artist_${signingTagIndex}}}`,
      color: "#FFFFFF",
      fontSize: 6,
      margin: [0, SIGN_SPACE_MARGIN, 0, 2],
    };
  } else {
    signingSpace = { text: " ", margin: [0, SIGN_SPACE_MARGIN, 0, 2] };
  }
  return {
    stack: [
      { text: title, bold: true, margin: [0, 12, 0, 0] },
      ...(name ? [{ text: name }] : []),
      signingSpace,
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: SIGN_LINE_WIDTH, y2: 0, lineWidth: 0.7, lineColor: "#333333" }] },
      { text: "Signature", fontSize: 8, color: "#888888", margin: [0, 4, 0, 0] },
    ],
    margin: [0, 0, 0, 12],
  };
};
```

Then change the signature-section builder inside `buildContractDoc` to thread the option. Update the signature declaration and the `signCells` construction:

```js
export const buildContractDoc = (data, { signingTags = false } = {}) => {
```

```js
  const signCells = [
    signatureBlock(dash(label.name).toUpperCase(), dash(label.owner), label.signatureImage),
    ...artists.map((a, i) =>
      signatureBlock(dash(a.alias), dash(a.legalName), undefined, signingTags ? i + 1 : undefined),
    ),
  ];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/domain/contractTemplate.test.js`
Expected: PASS (all prior tests + the 3 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/domain/contractTemplate.js src/domain/contractTemplate.test.js
git -c user.name="legiahuy" -c user.email="legiahuy51tambinh@gmail.com" commit --no-verify -m "Add invisible BoldSign text-tag signing variant to contract PDF"
```

---

## Task 3: Pure webhook→state reducer

**Files:**
- Create: `Recursive-backend/src/domain/esignEvents.js`
- Test: `Recursive-backend/src/domain/esignEvents.test.js`

**Interfaces:**
- Produces:
  - `EVENT_TO_DOC_STATUS` map and `reduceEsignEvent(eventType, signers)` where `signers` is `[{ email, status }]` (status one of `"Completed"|"Declined"|"Revoked"|"InProgress"|...` as BoldSign reports per-signer). Returns `{ documentStatus, signerStatuses }` where `documentStatus` is one of `sent|completed|declined|voided|expired|null` (null = leave unchanged) and `signerStatuses` is `[{ email, sign_status }]` with `sign_status` in `pending|signed|declined`.
- Consumed by: `esign.service.js` webhook handler (Task 6).

- [ ] **Step 1: Write the failing tests**

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test src/domain/esignEvents.test.js`
Expected: FAIL — module `esignEvents.js` does not exist.

- [ ] **Step 3: Implement the reducer**

```js
// Pure mapping from a BoldSign webhook event to desired local state.
// No I/O — the service layer applies these to the database.

const EVENT_TO_DOC_STATUS = {
  Sent: "sent",
  Completed: "completed",
  Declined: "declined",
  Revoked: "voided",
  Expired: "expired",
};

const signerStatusFromBoldSign = (status) => {
  if (status === "Completed") return "signed";
  if (status === "Declined") return "declined";
  return "pending";
};

export const reduceEsignEvent = (eventType, signers = []) => ({
  documentStatus: EVENT_TO_DOC_STATUS[eventType] ?? null,
  signerStatuses: signers.map((s) => ({
    email: s.email,
    sign_status: signerStatusFromBoldSign(s.status),
  })),
});

export { EVENT_TO_DOC_STATUS };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/domain/esignEvents.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/esignEvents.js src/domain/esignEvents.test.js
git -c user.name="legiahuy" -c user.email="legiahuy51tambinh@gmail.com" commit --no-verify -m "Add pure BoldSign webhook-event reducer"
```

---

## Task 4: BoldSign client + orchestration service

**Files:**
- Create: `Recursive-backend/src/services/esign.service.js`

**Interfaces:**
- Consumes: `buildContractDoc(data, { signingTags })` (Task 2), `reduceEsignEvent` (Task 3), `summarizeRoyalty`, `supabase`, `STAGES`, `ContractError`.
- Produces (all exported):
  - `sendForSignature(pipelineItemId)` → `{ documentId, esignStatus: "sent", sentAt }`.
  - `remindSignature(pipelineItemId)` → `{ ok: true }`.
  - `voidSignature(pipelineItemId, reason)` → `{ esignStatus: "voided" }`.
  - `getSignedContractUrl(pipelineItemId)` → `string | null` (signed URL for `signed_pdf_path`, else null).
  - `handleWebhookEvent({ eventType, documentId, signers })` → `{ applied: boolean }`.
  - Re-exports `ContractError` from `contract.service.js`.
- Consumes: `getOwnerSignature`, `normalizeArtists`, `LABEL` re-used from `contract.service.js` — these must be exported there first (Step 1) so the three-tier owner-signature fallback and artist normalization stay in one place (DRY).

- [ ] **Step 1: Export the shared helpers from `contract.service.js`**

In `src/services/contract.service.js`, add named exports so the esign service reuses the exact same owner-signature resolution (env → bucket → committed asset) and artist normalization instead of duplicating them. Change the declarations of `getOwnerSignature`, `normalizeArtists`, and the `LABEL` constant to be `export`ed (or add them to the existing `export { ContractError };` line). Confirm the final line reads:

```js
export { ContractError, getOwnerSignature, normalizeArtists, LABEL };
```

Run: `node --check src/services/contract.service.js`
Expected: no output, exit 0.

- [ ] **Step 2: Implement the esign service**

```js
import { createRequire } from "module";
import { supabase } from "../config/supabase.config.js";
import { STAGES } from "../domain/pipelineStages.js";
import { buildContractDoc, summarizeRoyalty } from "../domain/contractTemplate.js";
import { reduceEsignEvent } from "../domain/esignEvents.js";
import { ContractError, getOwnerSignature, normalizeArtists, LABEL } from "./contract.service.js";

const require = createRequire(import.meta.url);
const pdfMake = require("pdfmake/build/pdfmake.js");
const pdfFonts = require("pdfmake/build/vfs_fonts.js");
pdfMake.addVirtualFileSystem(pdfFonts);

const BASE_URL = process.env.BOLDSIGN_BASE_URL || "https://api.boldsign.com";
const API_KEY = process.env.BOLDSIGN_API_KEY;
const CONTRACTS_BUCKET = "contracts";
const SIGNED_URL_TTL = 300;

const renderPdfBuffer = (doc) => pdfMake.createPdf(doc).getBuffer();

const bsHeaders = () => {
  if (!API_KEY) throw new ContractError(500, "BOLDSIGN_API_KEY is not configured");
  return { "X-API-KEY": API_KEY };
};

const canSend = (stage) => stage !== "cancelled" && STAGES.indexOf(stage) >= STAGES.indexOf("negotiation");

const loadItem = async (id) => {
  const { data, error } = await supabase
    .from("pipeline_items")
    .select("id, stage, track_title, agreed_release_date, catalog_code, contract_pdf_path, " +
      "contract_effective_date, esign_document_id, esign_status, signed_pdf_path, " +
      "pipeline_collaborators(id, email, form_status, form_data)")
    .eq("id", id)
    .single();
  if (error || !data) throw new ContractError(404, "Pipeline item not found");
  return data;
};

export const sendForSignature = async (pipelineItemId) => {
  const item = await loadItem(pipelineItemId);
  if (!item.contract_pdf_path) throw new ContractError(409, "Generate the contract before sending for signature");
  if (!canSend(item.stage)) throw new ContractError(409, "Contract can only be sent from the negotiation stage onward");
  if (item.esign_status === "sent") throw new ContractError(409, "A signature request is already in progress");

  const artists = normalizeArtists(item.pipeline_collaborators);
  if (artists.length === 0) throw new ContractError(422, "No submitted collaborators to sign");

  const signatureImage = await getOwnerSignature();
  const doc = buildContractDoc(
    { label: { ...LABEL, signatureImage }, trackTitle: item.track_title,
      effectiveDate: item.contract_effective_date, expectedReleaseDate: item.agreed_release_date, artists },
    { signingTags: true },
  );
  summarizeRoyalty(artists); // parity with generate flow (no-op guard)
  const pdf = await renderPdfBuffer(doc);

  // Build the multipart send request. Signer order == artist order == 1-based tag index.
  const form = new FormData();
  form.append("Title", `Recording Contract — ${item.track_title || item.catalog_code || item.id}`);
  form.append("UseTextTags", "true");
  form.append("EnableSigningOrder", "false");
  form.append("DisableEmails", "false");
  form.append("Files", new Blob([pdf], { type: "application/pdf" }), "contract.pdf");
  for (const a of artists) {
    form.append("Signers", JSON.stringify({ Name: a.legalName || a.alias || "Artist", EmailAddress: a.email, SignerType: "Signer" }));
  }

  const res = await fetch(`${BASE_URL}/v1/document/send`, { method: "POST", headers: bsHeaders(), body: form });
  if (!res.ok) throw new ContractError(502, `BoldSign send failed (${res.status}): ${await res.text()}`);
  const { documentId } = await res.json();
  if (!documentId) throw new ContractError(502, "BoldSign did not return a documentId");

  const sentAt = new Date().toISOString();
  const { error: upErr } = await supabase.from("pipeline_items").update({
    esign_document_id: documentId, esign_status: "sent", esign_sent_at: sentAt,
    stage: "contract_sent", stage_changed_at: sentAt, updated_at: sentAt,
  }).eq("id", pipelineItemId);
  if (upErr) throw new ContractError(500, `Failed to save e-sign state: ${upErr.message}`);

  // Mark each submitted collaborator pending.
  await supabase.from("pipeline_collaborators")
    .update({ sign_status: "pending" })
    .in("id", artists.map((a) => a.id));

  return { documentId, esignStatus: "sent", sentAt };
};

export const remindSignature = async (pipelineItemId) => {
  const item = await loadItem(pipelineItemId);
  if (!item.esign_document_id || item.esign_status !== "sent")
    throw new ContractError(409, "No in-progress signature request to remind");
  const res = await fetch(`${BASE_URL}/v1/document/remind?documentId=${encodeURIComponent(item.esign_document_id)}`,
    { method: "POST", headers: { ...bsHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ Message: "A friendly reminder to sign your Recursive Recordings contract." }) });
  if (!res.ok) throw new ContractError(502, `BoldSign remind failed (${res.status}): ${await res.text()}`);
  return { ok: true };
};

export const voidSignature = async (pipelineItemId, reason) => {
  const item = await loadItem(pipelineItemId);
  if (!item.esign_document_id || item.esign_status !== "sent")
    throw new ContractError(409, "No in-progress signature request to void");
  const message = (reason && String(reason).trim()) || "Voided by the label.";
  const res = await fetch(`${BASE_URL}/v1/document/revoke?documentId=${encodeURIComponent(item.esign_document_id)}`,
    { method: "POST", headers: { ...bsHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ Message: message }) });
  if (!res.ok) throw new ContractError(502, `BoldSign revoke failed (${res.status}): ${await res.text()}`);
  const now = new Date().toISOString();
  await supabase.from("pipeline_items").update({ esign_status: "voided", updated_at: now }).eq("id", pipelineItemId);
  return { esignStatus: "voided" };
};

export const getSignedContractUrl = async (pipelineItemId) => {
  const { data, error } = await supabase.from("pipeline_items")
    .select("signed_pdf_path").eq("id", pipelineItemId).single();
  if (error || !data?.signed_pdf_path) return null;
  const { data: signed, error: sErr } = await supabase.storage
    .from(CONTRACTS_BUCKET).createSignedUrl(data.signed_pdf_path, SIGNED_URL_TTL);
  return sErr ? null : signed.signedUrl;
};

// Download the completed PDF from BoldSign and archive it in the private bucket.
const archiveSignedPdf = async (item) => {
  const res = await fetch(`${BASE_URL}/v1/document/download?documentId=${encodeURIComponent(item.esign_document_id)}`,
    { method: "GET", headers: bsHeaders() });
  if (!res.ok) throw new ContractError(502, `BoldSign download failed (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const path = `${item.id}/${item.catalog_code || item.id}-signed.pdf`;
  const { error } = await supabase.storage.from(CONTRACTS_BUCKET)
    .upload(path, buf, { contentType: "application/pdf", upsert: true });
  if (error) throw new ContractError(500, `Signed PDF upload failed: ${error.message}`);
  return path;
};

// Idempotent: applies a reduced event to the matching pipeline item (found by documentId).
export const handleWebhookEvent = async ({ eventType, documentId, signers }) => {
  if (!documentId) return { applied: false };
  const { data: item } = await supabase.from("pipeline_items")
    .select("id, stage, catalog_code, esign_document_id, esign_status, signed_pdf_path")
    .eq("esign_document_id", documentId).single();
  if (!item) return { applied: false };

  const { documentStatus, signerStatuses } = reduceEsignEvent(eventType, signers);

  // Per-signer sync (match by email within this item's collaborators).
  for (const s of signerStatuses) {
    const patch = { sign_status: s.sign_status };
    if (s.sign_status === "signed") patch.signed_at = new Date().toISOString();
    await supabase.from("pipeline_collaborators").update(patch)
      .eq("pipeline_item_id", item.id).eq("email", s.email);
  }

  if (!documentStatus) return { applied: true };

  const now = new Date().toISOString();
  const update = { esign_status: documentStatus, updated_at: now };
  if (documentStatus === "completed" && item.esign_status !== "completed") {
    update.signed_pdf_path = await archiveSignedPdf(item);
    update.esign_completed_at = now;
    update.stage = "signed";
    update.stage_changed_at = now;
  }
  await supabase.from("pipeline_items").update(update).eq("id", item.id);
  return { applied: true };
};

export { ContractError };
```

- [ ] **Step 3: Syntax-check the module**

Run: `node --check src/services/esign.service.js`
Expected: no output, exit 0.

- [ ] **Step 4: Re-run the domain suite (no regressions)**

Run: `npm test`
Expected: all domain tests pass (contractTemplate + esignEvents + existing).

- [ ] **Step 5: Commit**

```bash
git add src/services/esign.service.js src/services/contract.service.js
git -c user.name="legiahuy" -c user.email="legiahuy51tambinh@gmail.com" commit --no-verify -m "Add BoldSign e-sign client + orchestration service"
```

---

## Task 5: Admin controllers + routes

**Files:**
- Modify: `Recursive-backend/src/controllers/pipeline.controller.js`
- Modify: `Recursive-backend/src/routes/pipeline.routes.js`

**Interfaces:**
- Consumes: `sendForSignature`, `remindSignature`, `voidSignature`, `getSignedContractUrl`, `ContractError` from `esign.service.js`.
- Produces: handlers `sendContractHandler`, `remindContractHandler`, `voidContractHandler`, `getSignedContractHandler`; routes `POST /:id/contract/send`, `POST /:id/contract/remind`, `POST /:id/contract/void`, `GET /:id/contract/signed`.

- [ ] **Step 1: Add the import in `pipeline.controller.js`**

Below the existing contract import (around line 7), add:

```js
import {
  sendForSignature, remindSignature, voidSignature, getSignedContractUrl,
} from "../services/esign.service.js";
```

- [ ] **Step 2: Add the four handlers**

Append near `getContractHandler` (reuse its `ContractError` mapping style):

```js
export const sendContractHandler = async (req, res) => {
  try {
    res.status(200).json(await sendForSignature(req.params.id));
  } catch (error) {
    if (error instanceof ContractError) return res.status(error.status || 400).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
};

export const remindContractHandler = async (req, res) => {
  try {
    res.status(200).json(await remindSignature(req.params.id));
  } catch (error) {
    if (error instanceof ContractError) return res.status(error.status || 400).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
};

export const voidContractHandler = async (req, res) => {
  try {
    res.status(200).json(await voidSignature(req.params.id, req.body?.reason));
  } catch (error) {
    if (error instanceof ContractError) return res.status(error.status || 400).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
};

export const getSignedContractHandler = async (req, res) => {
  try {
    const signedUrl = await getSignedContractUrl(req.params.id);
    if (!signedUrl) return res.status(404).json({ error: "No signed contract yet" });
    res.status(200).json({ signedUrl });
  } catch (error) {
    if (error instanceof ContractError) return res.status(error.status || 400).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
};
```

> `ContractError` is already imported in this controller (line 7). If not in scope, add it to the esign import above.

- [ ] **Step 3: Register the routes in `pipeline.routes.js`**

Add to the import list and after the existing contract routes:

```js
import {
  // ...existing...
  sendContractHandler, remindContractHandler, voidContractHandler, getSignedContractHandler,
} from "../controllers/pipeline.controller.js";
```

```js
pipelineRouter.post("/:id/contract/send", verifyToken, isAdmin, sendContractHandler);
pipelineRouter.post("/:id/contract/remind", verifyToken, isAdmin, remindContractHandler);
pipelineRouter.post("/:id/contract/void", verifyToken, isAdmin, voidContractHandler);
pipelineRouter.get("/:id/contract/signed", verifyToken, isAdmin, getSignedContractHandler);
```

- [ ] **Step 4: Syntax-check both files**

Run: `node --check src/controllers/pipeline.controller.js; node --check src/routes/pipeline.routes.js`
Expected: no output, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/controllers/pipeline.controller.js src/routes/pipeline.routes.js
git -c user.name="legiahuy" -c user.email="legiahuy51tambinh@gmail.com" commit --no-verify -m "Add admin e-sign endpoints (send/remind/void/signed)"
```

---

## Task 6: Webhook route with HMAC verification

**Files:**
- Create: `Recursive-backend/src/routes/webhooks.routes.js`
- Modify: `Recursive-backend/src/controllers/pipeline.controller.js` (add `boldsignWebhookHandler`)
- Modify: `Recursive-backend/src/app.js` (capture raw body; mount webhook router before nothing else needed since it is its own path)

**Interfaces:**
- Consumes: `handleWebhookEvent` from `esign.service.js`; `reduceEsignEvent` indirectly.
- Produces: `POST /api/webhooks/boldsign` — verifies `X-BoldSign-Signature`, extracts `{ eventType, documentId, signers }`, calls `handleWebhookEvent`, returns 200. `req.rawBody` (string) populated by `express.json`'s `verify` callback.

- [ ] **Step 1: Capture the raw body in `app.js`**

Replace `app.use(express.json());` with a version that stashes the raw bytes (needed for HMAC):

```js
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf.toString("utf8"); },
}));
```

And mount the webhook router alongside the other routers:

```js
import webhooksRouter from "./routes/webhooks.routes.js";
// ...
app.use("/api/webhooks", webhooksRouter);
```

- [ ] **Step 2: Add the webhook handler in `pipeline.controller.js`**

```js
import crypto from "crypto";
import { handleWebhookEvent } from "../services/esign.service.js";

// Verify BoldSign's "t=<ts>, s0=<sig>[, s1=<sig>]" HMAC-SHA256 header over `${t}.${rawBody}`.
const verifyBoldSignSignature = (rawBody, header, secret) => {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=").map((x) => x.trim())));
  const t = parts.t;
  if (!t) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false; // replay window
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  return ["s0", "s1"].some((k) => {
    const sig = parts[k];
    if (!sig) return false;
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(sig, "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
};

// Defensively pull the fields we need from the BoldSign payload shape.
const parseBoldSignEvent = (body) => {
  const eventType = body?.event?.eventType || body?.eventType;
  const data = body?.data || {};
  const documentId = data.documentId || body?.documentId;
  const signerList = data.signerDetails || data.signers || [];
  const signers = signerList.map((s) => ({
    email: s.signerEmail || s.emailAddress || s.email,
    status: s.status,
  }));
  return { eventType, documentId, signers };
};

export const boldsignWebhookHandler = async (req, res) => {
  const ok = verifyBoldSignSignature(
    req.rawBody, req.headers["x-boldsign-signature"], process.env.BOLDSIGN_WEBHOOK_SECRET,
  );
  if (!ok) return res.status(401).json({ error: "Invalid signature" });
  try {
    await handleWebhookEvent(parseBoldSignEvent(req.body));
    res.status(200).json({ received: true });
  } catch (error) {
    // Log and 200 to avoid infinite BoldSign retries on our transient errors,
    // EXCEPT signature failures (already 401 above). Surface 500 only on hard failures.
    console.error("BoldSign webhook error:", error.message);
    res.status(500).json({ error: "Webhook processing failed" });
  }
};
```

> BoldSign delivers one event per signer action plus a document-level `Completed`. The `signerDetails` array carries every signer's current status, so `handleWebhookEvent` re-syncs all signers on every event — making delivery idempotent and order-independent.

- [ ] **Step 3: Create `webhooks.routes.js`**

```js
import { Router } from "express";
import { boldsignWebhookHandler } from "../controllers/pipeline.controller.js";

const webhooksRouter = Router();

// Public (no auth) — authenticity is enforced by HMAC signature verification.
webhooksRouter.post("/boldsign", boldsignWebhookHandler);

export default webhooksRouter;
```

- [ ] **Step 4: Syntax-check**

Run: `node --check src/app.js; node --check src/routes/webhooks.routes.js; node --check src/controllers/pipeline.controller.js`
Expected: no output, exit 0.

- [ ] **Step 5: Manual signature-verification smoke test**

Create a throwaway script `tmp-webhook-check.mjs`:

```js
import crypto from "crypto";
const secret = "testsecret";
const raw = JSON.stringify({ event: { eventType: "Completed" }, data: { documentId: "doc1", signerDetails: [{ signerEmail: "a@x.com", status: "Completed" }] } });
const t = Math.floor(Date.now() / 1000);
const s0 = crypto.createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
console.log(`X-BoldSign-Signature: t=${t}, s0=${s0}`);
```

Run: `node tmp-webhook-check.mjs` then reason that `verifyBoldSignSignature(raw, "t=<t>, s0=<s0>", "testsecret")` returns true and any tampered `raw` returns false. Delete the script: `Remove-Item tmp-webhook-check.mjs`.
Expected: header prints; logic review confirms accept/reject.

- [ ] **Step 6: Commit**

```bash
git add src/app.js src/routes/webhooks.routes.js src/controllers/pipeline.controller.js
git -c user.name="legiahuy" -c user.email="legiahuy51tambinh@gmail.com" commit --no-verify -m "Add HMAC-verified BoldSign webhook endpoint"
```

---

## Task 7: Frontend service methods + types

**Files:**
- Modify: `Recursive-Web/services/pipelineService.ts`

**Interfaces:**
- Produces: extended `PipelineItem` (esign fields), extended `PipelineCollaborator` (`sign_status`, `signed_at`), and methods `sendContract(id)`, `remindContract(id)`, `voidContract(id, reason)`, `getSignedContractUrl(id)`.

- [ ] **Step 1: Extend the interfaces**

In `PipelineCollaborator` add:

```ts
  sign_status?: "pending" | "signed" | "declined" | null;
  signed_at?: string | null;
```

In `PipelineItem` add (after the `contract_*` fields):

```ts
  esign_document_id?: string | null;
  esign_status?: "none" | "sent" | "completed" | "declined" | "voided" | "expired" | null;
  esign_sent_at?: string | null;
  esign_completed_at?: string | null;
  signed_pdf_path?: string | null;
```

- [ ] **Step 2: Add the methods**

After `getContractUrl` in the `pipelineService` object:

```ts
  sendContract: async (id: string): Promise<{ documentId: string; esignStatus: string; sentAt: string }> =>
    (await axiosClient.post(`/pipeline/${id}/contract/send`, {})).data,
  remindContract: async (id: string): Promise<{ ok: boolean }> =>
    (await axiosClient.post(`/pipeline/${id}/contract/remind`, {})).data,
  voidContract: async (id: string, reason: string): Promise<{ esignStatus: string }> =>
    (await axiosClient.post(`/pipeline/${id}/contract/void`, { reason })).data,
  getSignedContractUrl: async (id: string): Promise<{ signedUrl: string }> =>
    (await axiosClient.get(`/pipeline/${id}/contract/signed`)).data,
```

- [ ] **Step 3: Type-check**

Run: `pnpm lint`
Expected: no new errors in `services/pipelineService.ts`.

- [ ] **Step 4: Commit**

```bash
git add services/pipelineService.ts
git -c user.name="legiahuy" -c user.email="legiahuy51tambinh@gmail.com" commit --no-verify -m "Add e-sign pipeline service methods + types"
```

---

## Task 8: Frontend signature panel in the drawer

**Files:**
- Modify: `Recursive-Web/components/admin/pipeline/PipelineDetail.tsx`

**Interfaces:**
- Consumes: `pipelineService.sendContract/remindContract/voidContract/getSignedContractUrl`, `PipelineItem.esign_status`, `pipeline_collaborators[].sign_status`.
- Produces: a signature panel rendered inside the existing `canGenerateContract` block, plus handlers `handleSendContract`, `handleRemindContract`, `handleVoidContract`, `handleDownloadSigned`.

- [ ] **Step 1: Add local state (near the other contract state, ~line 133)**

```tsx
  const [sendingContract, setSendingContract] = useState(false);
  const [voidingContract, setVoidingContract] = useState(false);
```

- [ ] **Step 2: Add the handlers (after `handleDownloadContract`, ~line 335)**

```tsx
  const applyEsign = (patch: Partial<PipelineItem>) => {
    if (!item) return;
    const updated = { ...item, ...patch };
    setItem(updated);
    onItemChanged(updated);
  };

  const handleSendContract = async () => {
    if (!item) return;
    setSendingContract(true);
    try {
      const res = await pipelineService.sendContract(item.id);
      applyEsign({ esign_status: "sent", esign_sent_at: res.sentAt, stage: "contract_sent" });
      toast({ title: "Sent for signature" });
    } catch (error) {
      toast({ title: "Send failed", description: extractErrorMessage(error), variant: "destructive" });
    } finally {
      setSendingContract(false);
    }
  };

  const handleRemindContract = async () => {
    if (!item) return;
    try {
      await pipelineService.remindContract(item.id);
      toast({ title: "Reminder sent" });
    } catch (error) {
      toast({ title: "Reminder failed", description: extractErrorMessage(error), variant: "destructive" });
    }
  };

  const handleVoidContract = async () => {
    if (!item) return;
    setVoidingContract(true);
    try {
      await pipelineService.voidContract(item.id, "Voided by the label.");
      applyEsign({ esign_status: "voided" });
      toast({ title: "Signature request voided" });
    } catch (error) {
      toast({ title: "Void failed", description: extractErrorMessage(error), variant: "destructive" });
    } finally {
      setVoidingContract(false);
    }
  };

  const handleDownloadSigned = async () => {
    if (!item) return;
    try {
      const { signedUrl } = await pipelineService.getSignedContractUrl(item.id);
      window.open(signedUrl, "_blank");
    } catch (error) {
      toast({ title: "Download failed", description: extractErrorMessage(error), variant: "destructive" });
    }
  };

  const signedCount = (item?.pipeline_collaborators || []).filter((c) => c.sign_status === "signed").length;
  const signerCount = (item?.pipeline_collaborators || []).filter(
    (c) => c.form_status === "submitted",
  ).length;
```

- [ ] **Step 3: Render the panel inside the `canGenerateContract` block**

Immediately after the existing `Download contract` button (inside the `{item.contract_pdf_path && (...)}` sibling area, before the closing `</div>` of the contract row, ~line 668), add:

```tsx
                {item.contract_pdf_path && (item.esign_status ?? "none") === "none" && (
                  <Button type="button" size="sm" onClick={handleSendContract} disabled={sendingContract}>
                    {sendingContract ? "Sending…" : "Send for signature"}
                  </Button>
                )}
                {item.esign_status === "sent" && (
                  <>
                    <span className="inline-flex items-center rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-300">
                      Out for signature · {signedCount} of {signerCount} signed
                    </span>
                    <Button type="button" variant="outline" size="sm" onClick={handleRemindContract}>
                      Resend
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={handleVoidContract} disabled={voidingContract}>
                      {voidingContract ? "Voiding…" : "Void"}
                    </Button>
                  </>
                )}
                {item.esign_status === "completed" && (
                  <>
                    <span className="inline-flex items-center rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-300">
                      Signed
                    </span>
                    <Button type="button" variant="outline" size="sm" onClick={handleDownloadSigned}>
                      Download signed
                    </Button>
                  </>
                )}
                {(item.esign_status === "declined" || item.esign_status === "voided" || item.esign_status === "expired") && (
                  <>
                    <span className="inline-flex items-center rounded-full border border-rose-400/25 bg-rose-400/10 px-2 py-0.5 text-[11px] capitalize text-rose-300">
                      {item.esign_status}
                    </span>
                    <Button type="button" size="sm" onClick={handleSendContract} disabled={sendingContract}>
                      {sendingContract ? "Sending…" : "Re-send for signature"}
                    </Button>
                  </>
                )}
```

- [ ] **Step 4: Lint + build**

Run: `pnpm lint; pnpm build`
Expected: lint clean; build succeeds (static generation completes).

- [ ] **Step 5: Commit**

```bash
git add components/admin/pipeline/PipelineDetail.tsx
git -c user.name="legiahuy" -c user.email="legiahuy51tambinh@gmail.com" commit --no-verify -m "Add e-sign send/resend/void/download panel to pipeline drawer"
```

---

## Task 9: Env documentation + rollout notes

**Files:**
- Modify/Create: `Recursive-backend/.env.example`
- Modify: `C:\Users\t-huyle\Documents\Recursive\STATE.md` (control-center repo)

**Interfaces:** none (docs only).

- [ ] **Step 1: Document env vars**

Append to `Recursive-backend/.env.example` (create if absent):

```bash
# BoldSign e-signature (contract signing)
BOLDSIGN_BASE_URL=https://api.boldsign.com
BOLDSIGN_API_KEY=
BOLDSIGN_WEBHOOK_SECRET=
```

- [ ] **Step 2: Commit BE docs**

```bash
git add .env.example
git -c user.name="legiahuy" -c user.email="legiahuy51tambinh@gmail.com" commit --no-verify -m "Document BoldSign env vars"
```

- [ ] **Step 3: Update STATE.md (control-center repo, `master`)**

In `C:\Users\t-huyle\Documents\Recursive\STATE.md`, add a "Recent history" entry summarizing the e-sign feature (BoldSign, sandbox-first, manual setup: create account, API key, webhook `https://api.recursiverecordings.com/api/webhooks/boldsign`, apply `add_esign_columns.sql`), then commit with the same identity.

```bash
git -c user.name="legiahuy" -c user.email="legiahuy51tambinh@gmail.com" commit --no-verify -m "Note contract e-sign feature in STATE" -- STATE.md
```

---

## Task 10: Rollout (manual — owner + operator)

**Not code.** Perform in order after the branches merge:

- [ ] Apply `migrations/add_esign_columns.sql` in the Supabase SQL editor.
- [ ] Create a **BoldSign sandbox** account; copy the sandbox **API key** → set `BOLDSIGN_API_KEY` (+ `BOLDSIGN_BASE_URL`) on Render.
- [ ] In BoldSign, create an **Account-level webhook** → URL `https://api.recursiverecordings.com/api/webhooks/boldsign`, subscribe to `Sent, Signed, Completed, Declined, Revoked, Expired, SendFailed`; copy the **webhook signing secret** → set `BOLDSIGN_WEBHOOK_SECRET` on Render.
- [ ] End-to-end sandbox test: generate a contract → **Send for signature** → sign as the test artist → confirm card shows `2 of N`, then `Signed`, signed PDF downloads, stage auto-advances to `signed`.
- [ ] Flip to a **live** BoldSign API key + secret when ready.

---

## Self-Review

**Spec coverage:** §3 field-mapping → Task 2; §4 data model → Task 1; §5.1 service → Task 4; §5.2 reducer+webhook → Tasks 3 & 6; §5.3 endpoints → Tasks 5 & 6; §6 FE → Tasks 7 & 8; §7 security → Task 6 (HMAC) + Task 9 (env); §8 testing → Tasks 2 & 3 unit tests; §9 rollout → Task 10. All covered.

**Placeholder scan:** No TBD/TODO; every code step shows complete code; commands have expected output.

**Type consistency:** `reduceEsignEvent(eventType, signers)` returns `{ documentStatus, signerStatuses:[{email, sign_status}] }` — consumed identically in Task 6/`handleWebhookEvent`. `esign_status` domain (`none|sent|completed|declined|voided|expired`) is consistent across migration (Task 1), service (Task 4), reducer (Task 3), FE types (Task 7), and FE panel (Task 8). Service method names (`sendForSignature`/`remindSignature`/`voidSignature`/`getSignedContractUrl`/`handleWebhookEvent`) match their imports in Tasks 5 & 6. FE method names (`sendContract`/`remindContract`/`voidContract`/`getSignedContractUrl`) match Tasks 7 & 8.
