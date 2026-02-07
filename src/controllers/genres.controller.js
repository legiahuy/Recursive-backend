import { supabase } from "../config/supabase.config.js";

export const getAllGenres = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("genres")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
