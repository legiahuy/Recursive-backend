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
