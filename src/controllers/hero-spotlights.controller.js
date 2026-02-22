import { supabase } from "../config/supabase.config.js";

export const getActiveHeroSpotlight = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("hero_spotlights")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllHeroSpotlights = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("hero_spotlights")
      .select("*")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createHeroSpotlight = async (req, res) => {
  try {
    const {
      title,
      subtitle,
      description,
      image_url,
      cta_text,
      cta_link,
      background_color,
      catalog_code,
      is_active,
      display_order,
    } = req.body;

    const { data, error } = await supabase
      .from("hero_spotlights")
      .insert([
        {
          title,
          subtitle,
          description,
          image_url,
          cta_text,
          cta_link,
          background_color,
          catalog_code,
          is_active,
          display_order,
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

export const updateHeroSpotlight = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data, error } = await supabase
      .from("hero_spotlights")
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

export const deleteHeroSpotlight = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from("hero_spotlights")
      .delete()
      .eq("id", id);

    if (error) throw error;

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
