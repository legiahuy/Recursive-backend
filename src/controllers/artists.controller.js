import { supabase } from "../config/supabase.config.js";

export const getFeaturedArtists = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("artists")
      .select("*")
      .eq("status", "active")
      .eq("is_featured", true)
      .limit(4);

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllArtists = async (req, res) => {
  const { page = 1, limit = 10, q } = req.query;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  try {
    let query = supabase
      .from("artists")
      .select("*", { count: "exact" })
      .eq("status", "active")
      .range(from, to)
      .order("name");

    if (q) {
      query = query.ilike("name", `%${q}%`);
    }

    const { data, count, error } = await query;

    if (error) throw error;

    res.json({ data, count, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getArtistBySlug = async (req, res) => {
  const { slug } = req.params;

  try {
    const { data: artist, error: artistError } = await supabase
      .from("artists")
      .select("*, artist_social_links(*)")
      .eq("slug", slug)
      .single();

    if (artistError) throw artistError;

    res.json(artist);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
