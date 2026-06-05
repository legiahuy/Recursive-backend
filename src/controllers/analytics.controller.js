import { supabase } from "../config/supabase.config.js";

export const trackAnalyticsEvent = async (req, res) => {
  const {
    event_name,
    event_type = "conversion",
    path,
    target_url,
    entity_type,
    entity_id,
    source = "website",
    metadata = {},
  } = req.body;

  if (!event_name) {
    return res.status(400).json({ error: "event_name is required" });
  }

  try {
    const { data, error } = await supabase
      .from("analytics_events")
      .insert([
        {
          event_name,
          event_type,
          path,
          target_url,
          entity_type,
          entity_id,
          source,
          metadata,
          referrer: req.get("referer") || req.get("referrer") || null,
          user_agent: req.get("user-agent") || null,
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

export const getAnalyticsSummary = async (req, res) => {
  const { limit = 1000 } = req.query;

  try {
    const { data, error } = await supabase
      .from("analytics_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(parseInt(limit));

    if (error) throw error;

    const events = data || [];
    const byEvent = {};
    const byPath = {};
    const byTarget = {};

    events.forEach((event) => {
      byEvent[event.event_name] = (byEvent[event.event_name] || 0) + 1;
      if (event.path) byPath[event.path] = (byPath[event.path] || 0) + 1;
      if (event.target_url) {
        byTarget[event.target_url] = (byTarget[event.target_url] || 0) + 1;
      }
    });

    const toSortedList = (obj) =>
      Object.entries(obj)
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    res.json({
      totalEvents: events.length,
      byEvent: toSortedList(byEvent),
      topPaths: toSortedList(byPath),
      topTargets: toSortedList(byTarget),
      recentEvents: events.slice(0, 20),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
