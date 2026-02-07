import { supabase } from "../config/supabase.config.js";

export const getFeaturedReleases = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("releases")
      .select(
        `
        *,
        release_artists(
          role,
          artists(id, name, slug)
        )
      `,
      )
      .eq("status", "released")
      .eq("is_featured", true)
      .limit(4)
      .order("release_date", { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllReleases = async (req, res) => {
  const { page = 1, limit = 10, q, genre } = req.query;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  try {
    let query = supabase
      .from("releases")
      .select(
        `
        *,
        release_artists(
          role,
          artists(id, name, slug)
        ),
        release_genres!inner(
          genres!inner(id, name, slug)
        )
      `,
        { count: "exact" },
      )
      .eq("status", "released")
      .range(from, to)
      .order("release_date", { ascending: false });

    if (q) {
      // Search by title or catalog_code
      query = query.or(`title.ilike.%${q}%,catalog_code.ilike.%${q}%`);
    }

    if (genre) {
      // Filter by genre slug through the joined table
      query = query.eq("release_genres.genres.slug", genre);
    }

    const { data, count, error } = await query;

    if (error) throw error;

    res.json({ data, count, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getReleaseBySlug = async (req, res) => {
  const { slug } = req.params;

  try {
    const { data, error } = await supabase
      .from("releases")
      .select(
        `
        *,
        release_artists(
          role,
          artists(id, name, slug)
        ),
        release_genres(
          genres(id, name, slug)
        )
      `,
      )
      .eq("slug", slug)
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
