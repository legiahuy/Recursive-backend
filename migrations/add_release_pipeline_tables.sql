-- Release pipeline: tracks accepted demos through signing -> release.

CREATE TABLE pipeline_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_submission_id UUID REFERENCES demo_submissions(id) ON DELETE SET NULL,
  release_id UUID REFERENCES releases(id) ON DELETE SET NULL,
  stage TEXT NOT NULL DEFAULT 'accepted'
    CHECK (stage IN ('accepted','info_requested','negotiation','contract_sent',
                     'signed','artwork','distribution','assets_presave','released','cancelled')),
  track_title TEXT,
  agreed_release_date DATE,
  catalog_code TEXT,
  isrc TEXT,
  soundcloud_link TEXT,
  presave_link TEXT,
  cover_image_url TEXT,
  notes TEXT,
  cancel_reason TEXT,
  stage_changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE pipeline_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_item_id UUID NOT NULL REFERENCES pipeline_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  form_token TEXT NOT NULL UNIQUE,
  form_status TEXT NOT NULL DEFAULT 'invited' CHECK (form_status IN ('invited','submitted')),
  form_data JSONB,
  artist_id UUID REFERENCES artists(id) ON DELETE SET NULL,
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  submitted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE pipeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_item_id UUID NOT NULL REFERENCES pipeline_items(id) ON DELETE CASCADE,
  from_stage TEXT,
  to_stage TEXT,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_pipeline_items_stage ON pipeline_items (stage);
CREATE INDEX idx_pipeline_items_demo ON pipeline_items (demo_submission_id);
CREATE INDEX idx_pipeline_collab_item ON pipeline_collaborators (pipeline_item_id);
CREATE INDEX idx_pipeline_collab_token ON pipeline_collaborators (form_token);
CREATE INDEX idx_pipeline_events_item ON pipeline_events (pipeline_item_id);

ALTER TABLE pipeline_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_events ENABLE ROW LEVEL SECURITY;

-- Service role (backend) bypasses RLS; permissive policies mirror existing tables.
CREATE POLICY "Service manages pipeline_items" ON pipeline_items FOR ALL USING (true);
CREATE POLICY "Service manages pipeline_collaborators" ON pipeline_collaborators FOR ALL USING (true);
CREATE POLICY "Service manages pipeline_events" ON pipeline_events FOR ALL USING (true);
