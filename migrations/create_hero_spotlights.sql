-- Create hero_spotlights table for admin-managed homepage hero content
CREATE TABLE hero_spotlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  image_url TEXT NOT NULL,
  cta_text TEXT DEFAULT 'Listen Now',
  cta_link TEXT,
  background_color TEXT DEFAULT '#1a1a1a',
  is_active BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Only one active spotlight at a time
CREATE UNIQUE INDEX idx_hero_spotlights_active ON hero_spotlights (is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE hero_spotlights ENABLE ROW LEVEL SECURITY;

-- Public can read active spotlights
CREATE POLICY "Public can view active hero spotlights" ON hero_spotlights
  FOR SELECT USING (is_active = true);

-- Admin can manage (add auth check later)
CREATE POLICY "Admin can manage hero spotlights" ON hero_spotlights
  FOR ALL USING (true);

-- Sample data for testing
INSERT INTO hero_spotlights (
  title,
  subtitle,
  description,
  image_url,
  cta_text,
  cta_link,
  is_active
) VALUES (
  'Our Moment',
  'Thunderbeatz, Awarfaithness & Kim Anna',
  'Some moments are meant to be felt, not rushed. A warm, emotional release built around connection and atmosphere 🌅✨',
  'https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=1200',
  'Pre-Save Now',
  'https://spotify.com',
  true
);
