import { createRequire } from "module";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
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
const OWNER_SIGNATURE_OBJECT = "_assets/owner-signature.png";
const OWNER_SIGNATURE_FILE = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "owner-signature.png");

const LABEL = {
  name: "Recursive Recordings",
  owner: "Le Gia Huy",
  email: "contact@recursiverecordings.com",
};

// The owner's signature is embedded into every contract so it never needs manual signing.
// Source, in priority order:
//   1. OWNER_SIGNATURE_DATA_URL env var (a full data: URL) — lets the owner override without a deploy;
//   2. a PNG uploaded to the private contracts bucket at `_assets/owner-signature.png`;
//   3. the committed asset at src/assets/owner-signature.png (the default — works out of the box).
// Cached in-process after the first load; replace the source + redeploy to refresh.
let ownerSignatureCache; // undefined = not loaded; null = loaded-but-absent; string = data URL
const getOwnerSignature = async () => {
  if (ownerSignatureCache !== undefined) return ownerSignatureCache || undefined;
  if (process.env.OWNER_SIGNATURE_DATA_URL) {
    ownerSignatureCache = process.env.OWNER_SIGNATURE_DATA_URL;
    return ownerSignatureCache;
  }
  try {
    const { data, error } = await supabase.storage
      .from(CONTRACTS_BUCKET)
      .download(OWNER_SIGNATURE_OBJECT);
    if (!error && data) {
      const base64 = Buffer.from(await data.arrayBuffer()).toString("base64");
      ownerSignatureCache = `data:image/png;base64,${base64}`;
      return ownerSignatureCache;
    }
  } catch {
    // fall through to the committed asset
  }
  try {
    const base64 = (await readFile(OWNER_SIGNATURE_FILE)).toString("base64");
    ownerSignatureCache = `data:image/png;base64,${base64}`;
    return ownerSignatureCache;
  } catch {
    ownerSignatureCache = null;
    return undefined;
  }
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

  const signatureImage = await getOwnerSignature();
  const data = {
    label: { ...LABEL, signatureImage },
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
      : `Artist splits total ${royalty.artistsTotal}% — expected 100%.`,
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
