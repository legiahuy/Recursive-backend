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
        artist_social_links(*),
        release_artists(
          role,
          order_index,
          releases(
            id,
            title,
            slug,
            release_date,
            cover_image_url,
            catalog_code,
            type,
            status,
            buy_link
          )
        )
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
  const {
    name,
    description,
    bio,
    image_url,
    slug,
    country,
    is_featured,
    status,
    seo_title,
    seo_description,
    og_image_url,
    canonical_url,
    social_links,
  } = req.body;

  try {
    const { data, error } = await supabase
      .from("artists")
      .insert([
        {
          name,
          description: description || bio,
          image_url,
          slug,
          country,
          is_featured: is_featured || false,
          status: status || "active",
          seo_title,
          seo_description,
          og_image_url,
          canonical_url,
        },
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (social_links && social_links.length > 0) {
      const links = social_links
        .filter((link) => link.platform && link.url)
        .map((link) => ({
          artist_id: data.id,
          platform: link.platform,
          url: link.url,
        }));

      if (links.length > 0) {
        const { error: linksError } = await supabase
          .from("artist_social_links")
          .insert(links);
        if (linksError) throw linksError;
      }
    }

    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateArtist = async (req, res) => {
  const { id } = req.params;
  const { bio, social_links, ...updates } = req.body;

  if (bio !== undefined && updates.description === undefined) {
    updates.description = bio;
  }

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

    if (social_links) {
      await supabase.from("artist_social_links").delete().eq("artist_id", id);

      const links = social_links
        .filter((link) => link.platform && link.url)
        .map((link) => ({
          artist_id: id,
          platform: link.platform,
          url: link.url,
        }));

      if (links.length > 0) {
        const { error: linksError } = await supabase
          .from("artist_social_links")
          .insert(links);
        if (linksError) throw linksError;
      }
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
