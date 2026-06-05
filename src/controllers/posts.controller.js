import { supabase } from "../config/supabase.config.js";

const normalizePostPayload = (body) => ({
  title: body.title,
  slug: body.slug,
  excerpt: body.excerpt,
  content: body.content,
  cover_image_url: body.cover_image_url,
  type: body.type || "news",
  status: body.status || "draft",
  published_at:
    body.status === "published"
      ? body.published_at || new Date().toISOString()
      : body.published_at || null,
  related_release_id: body.related_release_id || null,
  cta_text: body.cta_text,
  cta_link: body.cta_link,
  seo_title: body.seo_title,
  seo_description: body.seo_description,
  updated_at: new Date().toISOString(),
});

export const getPublishedPosts = async (req, res) => {
  const { page = 1, limit = 12, type, q } = req.query;
  const pageInt = parseInt(page);
  const limitInt = parseInt(limit);
  const from = (pageInt - 1) * limitInt;
  const to = from + limitInt - 1;

  try {
    let query = supabase
      .from("posts")
      .select("*", { count: "exact" })
      .eq("status", "published")
      .range(from, to)
      .order("published_at", { ascending: false });

    if (type) {
      query = query.eq("type", type);
    }

    if (q) {
      query = query.or(`title.ilike.%${q}%,excerpt.ilike.%${q}%`);
    }

    const { data, count, error } = await query;

    if (error) throw error;

    res.json({ data, count, page: pageInt, limit: limitInt });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllPosts = async (req, res) => {
  const { page = 1, limit = 50, type, status } = req.query;
  const pageInt = parseInt(page);
  const limitInt = parseInt(limit);
  const from = (pageInt - 1) * limitInt;
  const to = from + limitInt - 1;

  try {
    let query = supabase
      .from("posts")
      .select("*", { count: "exact" })
      .range(from, to)
      .order("created_at", { ascending: false });

    if (type) query = query.eq("type", type);
    if (status) query = query.eq("status", status);

    const { data, count, error } = await query;

    if (error) throw error;

    res.json({ data, count, page: pageInt, limit: limitInt });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getPostBySlug = async (req, res) => {
  const { slug } = req.params;
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      slug,
    );

  try {
    let query = supabase.from("posts").select("*");

    if (isUuid) {
      query = query.eq("id", slug);
    } else {
      query = query.eq("slug", slug);
    }

    if (!req.userId) {
      query = query.eq("status", "published");
    }

    const { data, error } = await query.single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createPost = async (req, res) => {
  try {
    const payload = normalizePostPayload(req.body);
    delete payload.updated_at;

    const { data, error } = await supabase
      .from("posts")
      .insert([payload])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updatePost = async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from("posts")
      .update(normalizePostPayload(req.body))
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deletePost = async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase.from("posts").delete().eq("id", id);

    if (error) throw error;

    res.json({ message: "Post deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
