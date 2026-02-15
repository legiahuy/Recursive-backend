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
          order_index,
          artists(id, name, slug)
        )
      `,
      )
      .eq("status", "released")
      .eq("is_featured", true)
      .order("release_date", { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllReleases = async (req, res) => {
  const { page = 1, limit = 10, q, genre } = req.query;
  const pageInt = parseInt(page);
  const limitInt = parseInt(limit);
  const from = (pageInt - 1) * limitInt;
  const to = from + limitInt - 1;

  try {
    let query = supabase
      .from("releases")
      .select(
        `
        *,
        release_artists(
          role,
          order_index,
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

    res.json({ data, count, page: pageInt, limit: limitInt });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getReleaseBySlug = async (req, res) => {
  const { slug } = req.params;
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      slug,
    );

  try {
    let query = supabase.from("releases").select(
      `
        *,
        release_artists(
          role,
          order_index,
          artists(id, name, slug)
        ),
        release_genres(
          genres(id, name, slug)
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

export const createRelease = async (req, res) => {
  const {
    title,
    slug,
    release_date,
    type,
    status,
    cover_image_url,
    catalog_code,
    description,
    buy_link,
    is_featured,
    artists, // Array of { artist_id, role, order_index }
    genres, // Array of genre_ids
  } = req.body;

  try {
    // 1. Create Release
    const { data: release, error: releaseError } = await supabase
      .from("releases")
      .insert([
        {
          title,
          slug,
          release_date,
          type,
          status: status || "released",
          cover_image_url,
          catalog_code,
          description,
          buy_link,
          is_featured: is_featured || false,
        },
      ])
      .select()
      .single();

    if (releaseError) throw releaseError;

    // 2. Insert Artists (if any)
    if (artists && artists.length > 0) {
      const releaseArtists = artists.map((a) => ({
        release_id: release.id,
        artist_id: a.artist_id,
        role: a.role || "primary",
        order_index: a.order_index || 0,
      }));

      const { error: artistsError } = await supabase
        .from("release_artists")
        .insert(releaseArtists);

      if (artistsError) throw artistsError;
    }

    // 3. Insert Genres (if any)
    if (genres && genres.length > 0) {
      const releaseGenres = genres.map((genreId) => ({
        release_id: release.id,
        genre_id: genreId,
      }));

      const { error: genresError } = await supabase
        .from("release_genres")
        .insert(releaseGenres);

      if (genresError) throw genresError;
    }

    res.status(201).json(release);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateRelease = async (req, res) => {
  const { id } = req.params;
  const {
    title,
    slug,
    release_date,
    type,
    status,
    cover_image_url,
    catalog_code,
    description,
    buy_link,
    is_featured,
    artists,
    genres,
  } = req.body;

  try {
    // 1. Update Release details
    const { data: release, error: releaseError } = await supabase
      .from("releases")
      .update({
        title,
        slug,
        release_date,
        type,
        status,
        cover_image_url,
        catalog_code,
        description,
        buy_link,
        is_featured,
      })
      .eq("id", id)
      .select()
      .single();

    if (releaseError) throw releaseError;

    // 2. Update Artists (Delete all and re-insert for simplicity)
    if (artists) {
      // Delete existing
      await supabase.from("release_artists").delete().eq("release_id", id);

      // Insert new
      if (artists.length > 0) {
        const releaseArtists = artists.map((a) => ({
          release_id: id,
          artist_id: a.artist_id,
          role: a.role || "primary",
          order_index: a.order_index || 0,
        }));
        const { error: artistsError } = await supabase
          .from("release_artists")
          .insert(releaseArtists);
        if (artistsError) throw artistsError;
      }
    }

    // 3. Update Genres
    if (genres) {
      // Delete existing
      await supabase.from("release_genres").delete().eq("release_id", id);

      // Insert new
      if (genres.length > 0) {
        const releaseGenres = genres.map((genreId) => ({
          release_id: id,
          genre_id: genreId,
        }));
        const { error: genresError } = await supabase
          .from("release_genres")
          .insert(releaseGenres);
        if (genresError) throw genresError;
      }
    }

    res.json(release);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteRelease = async (req, res) => {
  const { id } = req.params;

  try {
    // Rely on Cascade Delete for junction tables if configured, otherwise might need manual delete
    // Usually Supabase handles cascade if FK is set up with ON DELETE CASCADE
    const { error } = await supabase.from("releases").delete().eq("id", id);

    if (error) throw error;

    res.json({ message: "Release deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
