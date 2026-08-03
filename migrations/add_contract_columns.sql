-- Auto-fill contract: stores the generated PDF location + metadata per pipeline card.
ALTER TABLE pipeline_items
  ADD COLUMN IF NOT EXISTS contract_pdf_path TEXT,
  ADD COLUMN IF NOT EXISTS contract_generated_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS contract_effective_date DATE;
