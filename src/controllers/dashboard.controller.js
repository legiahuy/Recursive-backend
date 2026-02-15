import { supabase } from "../config/supabase.config.js";

export const getDashboardStats = async (req, res) => {
  try {
    const { count: releasesCount, error: releasesError } = await supabase
      .from("releases")
      .select("*", { count: "exact", head: true });

    if (releasesError) throw releasesError;

    const { count: artistsCount, error: artistsError } = await supabase
      .from("artists")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    if (artistsError) throw artistsError;

    const { count: pendingDemosCount, error: demosError } = await supabase
      .from("demo_submissions")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    if (demosError) throw demosError;

    const { count: spotlightsCount, error: spotlightsError } = await supabase
      .from("hero_spotlights")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    if (spotlightsError) throw spotlightsError;

    // Get recent activity (last 5 submissions)
    const { data: recentSubmissions, error: activityError } = await supabase
      .from("demo_submissions")
      .select("id, artist_name, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    if (activityError) throw activityError;

    res.json({
      releases: releasesCount,
      activeArtists: artistsCount,
      pendingDemos: pendingDemosCount,
      activeSpotlights: spotlightsCount,
      recentActivity: recentSubmissions,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
