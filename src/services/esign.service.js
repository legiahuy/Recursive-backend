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
  const status = item.esign_status || "none";
  if (status === "sent") {
    throw new ContractError(409, "A signature request is already in progress");
  }
  if (status === "completed") {
    throw new ContractError(409, "This contract has already been fully signed");
  }
  const SENDABLE = new Set(["none", "voided", "declined", "expired"]);
  if (!SENDABLE.has(status)) {
    throw new ContractError(409, `Cannot send for signature from status "${status}"`);
  }

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

  // BoldSign requires application/json with Signers as an ARRAY. A single-object
  // multipart "Signers" field does not bind to List<DocumentSigner> and is rejected
  // ("The email address field is required..."). Files are base64 data-URI strings.
  // Signer order == artist order == 1-based text-tag signer index.
  const payload = {
    Title: `Recording Contract — ${item.track_title || item.catalog_code || item.id}`,
    UseTextTags: true,
    EnableSigningOrder: false,
    DisableEmails: false,
    Files: [`data:application/pdf;base64,${Buffer.from(pdf).toString("base64")}`],
    Signers: artists.map((a) => ({
      Name: a.legalName || a.alias || "Artist",
      EmailAddress: a.email,
      SignerType: "Signer",
    })),
  };

  const res = await fetch(`${BASE_URL}/v1/document/send`, {
    method: "POST",
    headers: { ...bsHeaders(), "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new ContractError(502, `BoldSign send failed (${res.status}): ${await res.text()}`);
  const { documentId } = await res.json();
  if (!documentId) throw new ContractError(502, "BoldSign did not return a documentId");

  const sentAt = new Date().toISOString();
  const { error: upErr } = await supabase.from("pipeline_items").update({
    esign_document_id: documentId, esign_status: "sent", esign_sent_at: sentAt,
    stage: "contract_sent", stage_changed_at: sentAt, updated_at: sentAt,
  }).eq("id", pipelineItemId);
  if (upErr) throw new ContractError(500, `Failed to save e-sign state: ${upErr.message}`);

  // Mark each submitted collaborator pending. normalizeArtists() does not surface the
  // collaborator `id`, so match by `email` instead (unique per pipeline item, already
  // used for signer wiring above and for webhook sync below).
  await supabase.from("pipeline_collaborators")
    .update({ sign_status: "pending" })
    .eq("pipeline_item_id", pipelineItemId)
    .in("email", artists.map((a) => a.email));

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
