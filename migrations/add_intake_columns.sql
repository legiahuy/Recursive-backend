-- Release intake: lets an accepted artist submit track title + collaborators
-- via a one-shot token link before the owner sends the per-collaborator forms.

ALTER TABLE pipeline_items
  ADD COLUMN IF NOT EXISTS intake_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS intake_status TEXT DEFAULT 'pending'
    CHECK (intake_status IN ('pending','received')),
  ADD COLUMN IF NOT EXISTS intake_submitted_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_pipeline_items_intake_token
  ON pipeline_items (intake_token);
