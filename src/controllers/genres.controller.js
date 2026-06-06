import { supabase } from "../config/supabase.config.js";

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const ensureDefaultGenre = async () => {
  const { data: existing, error: existingError } = await supabase
    .from("genres")
    .select("*")
    .eq("slug", "edm")
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing;

  const { data, error } = await supabase
    .from("genres")
    .insert([{ name: "EDM", slug: "edm" }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getAllGenres = async (req, res) => {
  try {
    await ensureDefaultGenre();

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

export const createGenre = async (req, res) => {
  const { name, slug } = req.body;
  const nextName = name?.trim();
  const nextSlug = slugify(slug || name || "");

  if (!nextName || !nextSlug) {
    return res.status(400).json({ error: "Name is required" });
  }

  try {
    const { data: duplicate, error: duplicateError } = await supabase
      .from("genres")
      .select("id")
      .eq("slug", nextSlug)
      .maybeSingle();

    if (duplicateError) throw duplicateError;
    if (duplicate) {
      return res.status(400).json({ error: "Genre slug already exists" });
    }

    const { data, error } = await supabase
      .from("genres")
      .insert([{ name: nextName, slug: nextSlug }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateGenre = async (req, res) => {
  const { id } = req.params;
  const { name, slug } = req.body;
  const updates = {};

  if (name !== undefined) updates.name = name.trim();
  if (slug !== undefined) updates.slug = slugify(slug);
  if (name !== undefined && slug === undefined) updates.slug = slugify(name);

  if (!updates.name && !updates.slug) {
    return res.status(400).json({ error: "Name or slug is required" });
  }

  try {
    const { data: existing, error: existingError } = await supabase
      .from("genres")
      .select("*")
      .eq("id", id)
      .single();

    if (existingError) throw existingError;

    if (existing.slug === "edm" && updates.slug && updates.slug !== "edm") {
      return res.status(400).json({ error: "EDM genre slug cannot be changed" });
    }

    if (updates.slug) {
      const { data: duplicate, error: duplicateError } = await supabase
        .from("genres")
        .select("id")
        .eq("slug", updates.slug)
        .neq("id", id)
        .maybeSingle();

      if (duplicateError) throw duplicateError;
      if (duplicate) {
        return res.status(400).json({ error: "Genre slug already exists" });
      }
    }

    const { data, error } = await supabase
      .from("genres")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteGenre = async (req, res) => {
  const { id } = req.params;

  try {
    const defaultGenre = await ensureDefaultGenre();

    const { data: genre, error: genreError } = await supabase
      .from("genres")
      .select("*")
      .eq("id", id)
      .single();

    if (genreError) throw genreError;

    if (genre.slug === "edm") {
      return res.status(400).json({ error: "EDM genre cannot be deleted" });
    }

    const { data: linkedRows, error: linkedError } = await supabase
      .from("release_genres")
      .select("release_id")
      .eq("genre_id", id);

    if (linkedError) throw linkedError;

    const releaseIds = [...new Set((linkedRows || []).map((row) => row.release_id))];

    const { error: unlinkError } = await supabase
      .from("release_genres")
      .delete()
      .eq("genre_id", id);

    if (unlinkError) throw unlinkError;

    for (const releaseId of releaseIds) {
      const { data: existingDefault, error: existingDefaultError } =
        await supabase
          .from("release_genres")
          .select("release_id")
          .eq("release_id", releaseId)
          .eq("genre_id", defaultGenre.id)
          .maybeSingle();

      if (existingDefaultError) throw existingDefaultError;

      if (!existingDefault) {
        const { error: insertDefaultError } = await supabase
          .from("release_genres")
          .insert([{ release_id: releaseId, genre_id: defaultGenre.id }]);

        if (insertDefaultError) throw insertDefaultError;
      }
    }

    const { error } = await supabase.from("genres").delete().eq("id", id);

    if (error) throw error;

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
