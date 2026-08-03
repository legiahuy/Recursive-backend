import { createRequire } from "module";
import { supabase } from "../config/supabase.config.js";
import { STAGES } from "../domain/pipelineStages.js";
import { buildContractDoc, summarizeRoyalty } from "../domain/contractTemplate.js";

// pdfmake 0.3.x ships as a UMD bundle (CJS). Load it via createRequire so it resolves
// as CommonJS under our ESM project, then render server-side with createPdf().getBuffer().
// Verified recipe: addVirtualFileSystem(vfs) registers the bundled Roboto fonts — no
// external font files, no headless browser (Render-safe).
const require = createRequire(import.meta.url);
const pdfMake = require("pdfmake/build/pdfmake.js");
const pdfFonts = require("pdfmake/build/vfs_fonts.js");
pdfMake.addVirtualFileSystem(pdfFonts);

const CONTRACTS_BUCKET = "contracts";
const SIGNED_URL_TTL = 300; // seconds

const LABEL = {
  name: "Recursive Recordings",
  owner: "Le Gia Huy",
  email: "contact@recursiverecordings.com",
};

class ContractError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = "ContractError";
  }
}

const renderPdfBuffer = (docDefinition) => pdfMake.createPdf(docDefinition).getBuffer();

const canGenerate = (stage) =>
  stage !== "cancelled" && STAGES.indexOf(stage) >= STAGES.indexOf("negotiation");

const normalizeArtists = (collaborators) =>
  (collaborators || [])
    .filter((c) => c.form_status === "submitted" && c.form_data)
    .map((c) => {
      const f = c.form_data || {};
      return {
        alias: f.artist_name,
        legalName: f.legal_name,
        nationality: f.country,
        email: c.email,
        splitPercent: f.split_percent,
      };
    });

const yyyymmdd = (iso) => (typeof iso === "string" ? iso.replaceAll("-", "") : "");

export const generateContract = async (pipelineItemId, { effectiveDate }) => {
  const { data: item, error } = await supabase
    .from("pipeline_items")
    .select(
      "id, stage, track_title, agreed_release_date, catalog_code, " +
        "pipeline_collaborators(id, email, form_status, form_data)",
    )
    .eq("id", pipelineItemId)
    .single();
  if (error || !item) throw new ContractError(404, "Pipeline item not found");
  if (!canGenerate(item.stage)) {
    throw new ContractError(409, "Contract can only be generated from the negotiation stage onward");
  }

  const artists = normalizeArtists(item.pipeline_collaborators);
  if (artists.length === 0) {
    throw new ContractError(
      422,
      "No submitted collaborators yet — waiting on release-form submissions",
    );
  }

  const data = {
    label: LABEL,
    trackTitle: item.track_title,
    effectiveDate,
    expectedReleaseDate: item.agreed_release_date,
    artists,
  };
  const royalty = summarizeRoyalty(artists);
  const buffer = await renderPdfBuffer(buildContractDoc(data));

  const filenameBase = item.catalog_code || item.id;
  const path = `${item.id}/${filenameBase}-${yyyymmdd(effectiveDate)}.pdf`;

  const { error: upErr } = await supabase.storage
    .from(CONTRACTS_BUCKET)
    .upload(path, buffer, { contentType: "application/pdf", upsert: true });
  if (upErr) throw new ContractError(500, `Storage upload failed: ${upErr.message}`);

  const generatedAt = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("pipeline_items")
    .update({
      contract_pdf_path: path,
      contract_generated_at: generatedAt,
      contract_effective_date: effectiveDate,
      updated_at: generatedAt,
    })
    .eq("id", pipelineItemId);
  if (updErr) throw new ContractError(500, `Failed to save contract metadata: ${updErr.message}`);

  const { data: signed, error: signErr } = await supabase.storage
    .from(CONTRACTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (signErr) throw new ContractError(500, `Failed to sign URL: ${signErr.message}`);

  return {
    path,
    signedUrl: signed.signedUrl,
    generatedAt,
    effectiveDate,
    warning: royalty.balanced
      ? undefined
      : `Artist splits total ${royalty.artistsTotal}% — expected 50%.`,
  };
};

export const getContractUrl = async (pipelineItemId) => {
  const { data: item, error } = await supabase
    .from("pipeline_items")
    .select("contract_pdf_path")
    .eq("id", pipelineItemId)
    .single();
  if (error || !item || !item.contract_pdf_path) return null;

  const { data: signed, error: signErr } = await supabase.storage
    .from(CONTRACTS_BUCKET)
    .createSignedUrl(item.contract_pdf_path, SIGNED_URL_TTL);
  if (signErr) return null;
  return signed.signedUrl;
};

export { ContractError };
