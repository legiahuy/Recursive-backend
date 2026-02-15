import { supabase } from "../config/supabase.config.js";

export const getFeaturedArtists = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("artists")
      .select("*")
      .eq("status", "active")
      .eq("is_featured", true);

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllArtists = async (req, res) => {
  const { page = 1, limit = 10, q } = req.query;
  const pageInt = parseInt(page);
  const limitInt = parseInt(limit);
  const from = (pageInt - 1) * limitInt;
  const to = from + limitInt - 1;

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

    res.json({ data, count, page: pageInt, limit: limitInt });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getArtistBySlug = async (req, res) => {
  const { slug } = req.params;
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      slug,
    );

  try {
    let query = supabase.from("artists").select(
      `
        *,
        artist_social_links(*)
      `,
    );

    if (isUuid) {
      query = query.eq("id", slug);
    } else {
      query = query.eq("slug", slug);
    }

    const { data, error } = await query.single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createArtist = async (req, res) => {
  const { name, bio, image_url, slug, is_featured, status } = req.body;

  try {
    const { data, error } = await supabase
      .from("artists")
      .insert([
        {
          name,
          bio,
          image_url,
          slug,
          is_featured: is_featured || false,
          status: status || "active",
        },
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateArtist = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const { data, error } = await supabase
      .from("artists")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteArtist = async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase.from("artists").delete().eq("id", id);

    if (error) {
      throw error;
    }

    res.json({ message: "Artist deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
