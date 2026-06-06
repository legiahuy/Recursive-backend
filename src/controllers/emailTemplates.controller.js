import { supabase } from "../config/supabase.config.js";

const templateKeys = ["demo_acceptance", "demo_rejection", "demo_contacted"];

export const getEmailTemplates = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("email_templates")
      .select("*")
      .in("template_key", templateKeys)
      .order("name", { ascending: true });

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getEmailTemplateByKey = async (req, res) => {
  const { key } = req.params;

  try {
    const { data, error } = await supabase
      .from("email_templates")
      .select("*")
      .eq("template_key", key)
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateEmailTemplate = async (req, res) => {
  const { key } = req.params;
  const { subject, body } = req.body;

  if (!templateKeys.includes(key)) {
    return res.status(400).json({ error: "Unsupported email template key" });
  }

  if (!subject || !body) {
    return res.status(400).json({ error: "Subject and body are required" });
  }

  try {
    const { data, error } = await supabase
      .from("email_templates")
      .update({ subject, body, updated_at: new Date().toISOString() })
      .eq("template_key", key)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
