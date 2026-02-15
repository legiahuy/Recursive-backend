import { supabase } from "../config/supabase.config.js";

export const getActiveHeroSpotlight = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("hero_spotlights")
      .select("*")
      .eq("is_active", true)
      .single();

    // PGRST116 = no rows found, return null instead of error
    if (error && error.code !== "PGRST116") throw error;

    res.json(data || null);
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
