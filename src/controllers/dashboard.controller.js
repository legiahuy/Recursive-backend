import { supabase } from "../config/supabase.config.js";

const safeCount = async (table, filter) => {
  let query = supabase.from(table).select("*", { count: "exact", head: true });
  if (filter) query = filter(query);
  const { count, error } = await query;
  if (error) return 0;
  return count || 0;
};

export const getDashboardStats = async (req, res) => {
  try {
    const [
      releasesCount,
      artistsCount,
      pendingDemosCount,
      acceptedDemosCount,
      subscribersCount,
      spotlightsCount,
      releaseClicksCount,
      newsletterSignupEventsCount,
      demoSubmitEventsCount,
    ] = await Promise.all([
      safeCount("releases"),
      safeCount("artists", (query) => query.eq("status", "active")),
      safeCount("demo_submissions", (query) => query.eq("status", "pending")),
      safeCount("demo_submissions", (query) => query.eq("status", "accepted")),
      safeCount("newsletter_subscribers", (query) =>
        query.eq("status", "subscribed"),
      ),
      safeCount("hero_spotlights", (query) => query.eq("is_active", true)),
      safeCount("analytics_events", (query) =>
        query.eq("event_name", "release_cta_click"),
      ),
      safeCount("analytics_events", (query) =>
        query.eq("event_name", "newsletter_signup"),
      ),
      safeCount("analytics_events", (query) =>
        query.eq("event_name", "demo_submit"),
      ),
    ]);

    // Get recent activity (last 5 submissions)
    const { data: recentSubmissions, error: activityError } = await supabase
      .from("demo_submissions")
      .select("id, artist_name, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    if (activityError) throw activityError;

    const { data: recentEvents } = await supabase
      .from("analytics_events")
      .select("id,event_name,path,target_url,created_at")
      .order("created_at", { ascending: false })
      .limit(20);

    const pathCounts = {};
    const eventCounts = {};

    (recentEvents || []).forEach((event) => {
      if (event.path) pathCounts[event.path] = (pathCounts[event.path] || 0) + 1;
      eventCounts[event.event_name] = (eventCounts[event.event_name] || 0) + 1;
    });

    const toSortedList = (obj) =>
      Object.entries(obj)
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    res.json({
      releases: releasesCount,
      activeArtists: artistsCount,
      pendingDemos: pendingDemosCount,
      acceptedDemos: acceptedDemosCount,
      subscribers: subscribersCount,
      activeSpotlights: spotlightsCount,
      releaseClicks: releaseClicksCount,
      newsletterSignups: newsletterSignupEventsCount,
      demoSubmits: demoSubmitEventsCount,
      topPages: toSortedList(pathCounts),
      topEvents: toSortedList(eventCounts),
      recentEvents: recentEvents || [],
      recentActivity: recentSubmissions,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
