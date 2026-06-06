-- Admin workflow defaults for demo email templates and genre safety

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO email_templates (template_key, name, subject, body, description)
VALUES
  (
    'demo_acceptance',
    'Demo Acceptance',
    'Great news regarding your demo submission!',
    '<p>Hi {{artistName}},</p><p>We have listened to your demo and we really like what we hear.</p><p>We would love to discuss a potential release with you. Our team will reach out from {{contactEmail}} to discuss the release process and next steps.</p><p>Cheers,<br/>{{labelName}} Team</p>',
    'Default email sent when a demo is accepted.'
  ),
  (
    'demo_rejection',
    'Demo Rejection',
    'Update on your demo submission to Recursive Recordings',
    '<p>Hi {{artistName}},</p><p>Thank you for sending us your demo. We appreciate the time and effort you put into your music.</p><p>After careful consideration, we have decided not to move forward with this specific release. Please understand that this is not a reflection on your talent, but rather a decision based on our current schedule and curatorial direction.</p><p>We wish you the best of luck with your music and encourage you to submit again in the future.</p><p>Best regards,<br/>{{labelName}} Team</p>',
    'Default email sent when a demo is rejected.'
  ),
  (
    'demo_contacted',
    'Demo Contacted',
    'Next steps for your Recursive Recordings demo',
    '<p>Hi {{artistName}},</p><p>Thanks for sending your demo to {{labelName}}. We would like to continue the conversation and learn more about the track.</p><p>Please reply to this email or contact us at {{contactEmail}} with any extra release context, socials, and availability.</p><p>Best,<br/>{{labelName}} Team</p>',
    'Default email sent when a demo is marked contacted.'
  )
ON CONFLICT (template_key) DO NOTHING;

INSERT INTO genres (name, slug)
SELECT 'EDM', 'edm'
WHERE NOT EXISTS (
  SELECT 1 FROM genres WHERE slug = 'edm'
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage email templates" ON email_templates
  FOR ALL USING (true);
