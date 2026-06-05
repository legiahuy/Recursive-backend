import { supabase } from "../config/supabase.config.js";

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const subscribeNewsletter = async (req, res) => {
  const { email, name, source = "website", consent = false, tags = [] } = req.body;

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: "A valid email is required" });
  }

  try {
    const { data, error } = await supabase
      .from("newsletter_subscribers")
      .upsert(
        {
          email: email.toLowerCase().trim(),
          name,
          source,
          consent,
          tags,
          status: "subscribed",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" },
      )
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getNewsletterSubscribers = async (req, res) => {
  const { page = 1, limit = 50, q, status } = req.query;
  const pageInt = parseInt(page);
  const limitInt = parseInt(limit);
  const from = (pageInt - 1) * limitInt;
  const to = from + limitInt - 1;

  try {
    let query = supabase
      .from("newsletter_subscribers")
      .select("*", { count: "exact" })
      .range(from, to)
      .order("created_at", { ascending: false });

    if (q) {
      query = query.ilike("email", `%${q}%`);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data, count, error } = await query;

    if (error) throw error;

    res.json({ data, count, page: pageInt, limit: limitInt });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const exportNewsletterSubscribers = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("newsletter_subscribers")
      .select("email,name,source,status,consent,created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const rows = [
      ["email", "name", "source", "status", "consent", "created_at"],
      ...(data || []).map((sub) => [
        sub.email,
        sub.name || "",
        sub.source || "",
        sub.status || "",
        sub.consent ? "true" : "false",
        sub.created_at || "",
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=subscribers.csv");
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
