import { supabase } from "../config/supabase.config.js";

export const createSubmission = async (req, res) => {
  const { artist_name, email, stream_link, note } = req.body;

  try {
    const { data, error } = await supabase
      .from("demo_submissions")
      .insert([
        {
          artist_name,
          email,
          stream_link,
          note,
          status: "pending",
          source: "website",
        },
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
