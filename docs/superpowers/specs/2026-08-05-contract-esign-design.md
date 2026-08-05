# Contract E-Signature (BoldSign) — Design Spec

**Date:** 2026-08-05
**Status:** Approved (design), pending implementation plan
**Repos:** `Recursive-backend` (primary), `Recursive-Web` (admin UI extension)
**Depends on:** the shipped Auto-fill Contract → PDF feature (`contract.service.js`, `contractTemplate.js`, `pipeline_items` contract columns, private `contracts` Supabase bucket).

---

## 1. Purpose

Close the release-workflow loop from **contract generation → signature → signed archive** with minimal owner effort. Today the owner generates a contract PDF (their signature pre-embedded) and downloads it; the artist must be chased to sign out-of-band. This feature sends the generated contract to the collaborating artist(s) for legally-binding electronic signature via **BoldSign**, tracks per-signer progress, auto-advances the pipeline stage, and archives the completed signed PDF — all from the existing pipeline drawer.

**Success criteria:**
- From the pipeline drawer, the owner clicks **Send for signature** on an already-generated contract; the artist(s) receive a BoldSign email and sign online.
- The card shows live per-signer progress (e.g. `Out for signature · 2 of 3 signed`).
- When all artists sign, the signed PDF is archived to the private `contracts` bucket and the card auto-advances to the `signed` stage — no owner action.
- The owner can **Resend** (remind) and **Void** an in-flight request, and **Download** the final signed copy.
- Owner never signs manually — their signature stays pre-embedded in the PDF.

## 2. Locked decisions

| Decision | Choice |
|---|---|
| Signing parties | Owner signature **pre-embedded**; only artist(s) sign via BoldSign |
| Multi-artist order | **Parallel** — all get links at once; completes when the last signs |
| Admin controls | **Send · Resend · Void · Download signed** |
| Card detail | **Per-signer progress** (`X of N signed`) + Signed / Declined / Voided |
| Stage automation | Send → `contract_sent`; all-signed → `signed` |
| Invite delivery | **BoldSign emails the artist directly** (BoldSign-branded on free tier) |
| Service | **BoldSign** free (Essential) tier — 25 envelopes/month, full REST API, text-tags, webhooks, separate unlimited sandbox |
| Field mapping | **Text-tags embedded in the generated PDF** (Approach A) |

## 3. Field-mapping approach (Approach A — text-tags)

Because we generate the PDF ourselves with pdfmake, we inject **BoldSign text-tags** into each artist's signature block at generation time. BoldSign parses the uploaded PDF, finds the tags, and places each artist's signature + date field exactly on their line — no x/y coordinate math, robust to a variable number of artists and page breaks.

- The owner's signature block is unchanged (embedded image, **no** tag).
- Each artist block renders an **invisible** tag (white, tiny font) in place of the blank signing line, indexed to that signer (signer 1, 2, …), plus a date field tag.
- `buildContractDoc(data)` gains an optional `signingTags: true` flag producing the *signing variant*; the default (no flag) still produces the human-preview/download PDF with blank lines. This keeps the existing "generate + download unsigned draft" flow untouched.

Rejected alternatives: **B. absolute x/y coordinate fields** (pdfmake does not expose final rendered coordinates; brittle with dynamic artists/two-column wrap/multi-page); **C. pre-built BoldSign template** (contract is dynamic; free tier allows only 2 templates).

## 4. Data model (additive migration)

New idempotent migration `migrations/add_esign_columns.sql`, mirroring `add_contract_columns.sql` / `add_intake_columns.sql`. No new tables.

**`pipeline_items`** (envelope-level, one contract per card):

| Column | Type | Purpose |
|---|---|---|
| `esign_document_id` | text | BoldSign document/envelope ID |
| `esign_status` | text | `none` → `sent` → `completed` / `declined` / `voided` / `expired` |
| `esign_sent_at` | timestamptz | when sent |
| `esign_completed_at` | timestamptz | when all signed |
| `signed_pdf_path` | text | final signed PDF path in the `contracts` bucket (unsigned `contract_pdf_path` retained) |

**`pipeline_collaborators`** (per-signer progress):

| Column | Type | Purpose |
|---|---|---|
| `sign_status` | text | `pending` → `signed` / `declined` |
| `signed_at` | timestamptz | per-artist signature timestamp |
| `esign_signer_id` | text | BoldSign per-signer identifier, for webhook reconciliation |

`esign_status` defaults to `none`; `sign_status` is null until a request is sent.

## 5. Backend components

### 5.1 `src/services/esign.service.js` (new — isolated BoldSign client)

Single responsibility: talk to BoldSign and reconcile state. All BoldSign HTTP calls live here so they are mockable and the rest of the app has no BoldSign coupling. Reuses the `ContractError(status, message)` pattern for typed failures.

- `sendForSignature(pipelineItemId)`:
  1. Load item + **submitted** collaborators (`form_status='submitted'`), reuse `contract.service` normalization.
  2. Guard: contract already generated (`contract_pdf_path` present); stage `negotiation`-onward and not `cancelled`; `esign_status` in (`none`,`voided`,`declined`,`expired`) — block double-send while `sent`.
  3. Build the **signing-variant** PDF (`buildContractDoc({..., signingTags:true})` → `renderPdfBuffer`).
  4. POST to BoldSign `document/send` with signers = collaborator name/email (parallel `signingOrder`), `useTextTags` enabled, base URL from env (sandbox/live).
  5. Persist `esign_document_id`, per-signer `esign_signer_id` + `sign_status='pending'`, item `esign_status='sent'` + `esign_sent_at`.
  6. Auto-advance stage → `contract_sent` (via existing stage-update path; `canTransition` allows it).
- `remind(pipelineItemId)` → BoldSign `document/remind` for pending signers.
- `voidRequest(pipelineItemId, reason)` → BoldSign `document/revoke`; set `esign_status='voided'`.
- `getSignedUrl(pipelineItemId)` → signed URL for `signed_pdf_path` (300s TTL), falling back to the unsigned draft when not yet completed.

### 5.2 Webhook reducer (pure) + handler

- **Pure function** `esignEventToTransition(event)` (in `src/domain/`, unit-tested): maps a BoldSign event payload to a state transition `{ scope: 'signer'|'document', signerId?, status }`. No I/O.
- **Handler** `POST /api/webhooks/boldsign` (public route, HMAC-verified against `BOLDSIGN_WEBHOOK_SECRET`, registered **before** admin-guarded routes):
  - Verify signature header; reject forged/unsigned calls (401).
  - `Signed` (per signer) → set that collaborator `sign_status='signed'` + `signed_at`.
  - `Completed` → download final PDF from BoldSign, upload to `contracts` bucket as `signed_pdf_path`, set item `esign_status='completed'` + `esign_completed_at`, auto-advance stage → `signed`.
  - `Declined` / `Revoked` / `Expired` → set the matching `esign_status`.
  - **Idempotent**: re-delivered events converge to the same state (no duplicate stage jumps, guarded by current status).

### 5.3 Endpoints (on existing pipeline router; all `verifyToken`+`isAdmin` except webhook)

- `POST /api/pipeline/:id/contract/send`
- `POST /api/pipeline/:id/contract/remind`
- `POST /api/pipeline/:id/contract/void`  (body: optional `reason`)
- `GET  /api/pipeline/:id/contract/signed`
- `POST /api/webhooks/boldsign`  (no auth; HMAC-verified)

Error contract mirrors existing contract endpoints: `404` item/contract missing, `409` invalid state (e.g. already sent / wrong stage), `422` no submitted collaborators, `400` bad input, `5xx` upstream/storage failure.

## 6. Frontend (`Recursive-Web`)

Extends the existing contract UI in the admin pipeline drawer — additive, no new page, consistent with current admin design tokens. (Internal admin UI extending an existing component; no Hallmark public-mockup gate required.)

- `services/pipelineService.ts`: add `sendContract`, `remindContract`, `voidContract`, `getSignedContractUrl`.
- `PipelineDetail.tsx`:
  - After a contract is generated and `esign_status` is `none`/`voided`/`declined`/`expired`: show **Send for signature** button.
  - When `esign_status='sent'`: show a **signature status panel** — `Out for signature · X of N signed` with per-collaborator ticks — plus **Resend** and **Void** (confirm dialog).
  - When `esign_status='completed'`: show **Signed** badge + **Download signed** (opens signed URL).
  - `declined` / `voided` / `expired`: distinct badge + allow re-Send.
  - All interactive states covered (disabled/loading while calling; error toast on failure). Badge styling matches the existing "Contract · date" badge.

## 7. Security & reliability

- `BOLDSIGN_API_KEY`, `BOLDSIGN_WEBHOOK_SECRET`, `BOLDSIGN_BASE_URL` (sandbox↔live) as Render env vars — never committed.
- Webhook HMAC verification; idempotent event handling; unknown/duplicate events are safe no-ops.
- Signed PDFs remain in the **private** `contracts` bucket; only short-lived signed URLs are exposed.
- BoldSign/storage failures surface as typed `ContractError` → clean HTTP status, never a silent partial write (persist envelope id before/after send is ordered so a failure is recoverable/retryable).

## 8. Testing

- `contractTemplate.test.js`: signing-variant emits exactly one signature tag per artist with correct signer index; owner block has no tag; blank-line (non-signing) variant unchanged.
- `esignEventToTransition` pure-function tests: Signed / Completed / Declined / Revoked / Expired → correct transition; unknown event → no-op.
- BoldSign HTTP isolated behind `esign.service.js` (mockable); no live API in tests. Run: `node --test`.

## 9. Rollout (sandbox-first)

1. Implement + test against **BoldSign sandbox** (free, unlimited).
2. **Manual setup (owner):** create BoldSign account; generate API key; set webhook URL `https://api.recursiverecordings.com/api/webhooks/boldsign`; copy webhook secret into Render env; apply `add_esign_columns.sql`.
3. Flip `BOLDSIGN_BASE_URL` + key to **live** when ready.

## 10. Out of scope (YAGNI)

- Custom-branded invite email (owner chose BoldSign's direct email).
- Configurable auto-reminder cadence (manual Resend covers it).
- Envelope auto-expiry tuning (BoldSign default).
- Owner signing via BoldSign (signature stays pre-embedded).
- Countersign / sequential order, in-app embedded iframe signing.
