import { supabase } from "../config/supabase.config.js";

export const createSubmission = async (req, res) => {
  const { artist_name, email, stream_link, note } = req.body;

  try {
    const { data, error } = await supabase
      .from("demo_submissions")
      .insert([
        {
          artist_name,
          email,
          stream_link,
          note,
          status: "pending",
          source: "website",
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

export const getAllSubmissions = async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const pageInt = parseInt(page);
  const limitInt = parseInt(limit);
  const from = (pageInt - 1) * limitInt;
  const to = from + limitInt - 1;

  try {
    let query = supabase
      .from("demo_submissions")
      .select("*", { count: "exact" })
      .range(from, to)
      .order("created_at", { ascending: false });

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

import {
  sendAcceptanceEmail,
  sendRejectionEmail,
} from "../services/email.service.js";

export const updateSubmissionStatus = async (req, res) => {
  const { id } = req.params;
  const { status, note, emailMessage } = req.body;

  try {
    // 1. Update status in DB
    const { data, error } = await supabase
      .from("demo_submissions")
      .update({ status, note })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // 2. Send Email if status changed to rejected or accepted
    const artistName = data.artist_name || "Artist";
    const email = data.email;

    if (email) {
      if (status === "rejected") {
        await sendRejectionEmail(email, artistName);
      } else if (status === "accepted") {
        await sendAcceptanceEmail(email, artistName, emailMessage);
      }
    }

    res.json(data);
  } catch (error) {
    console.error("Error updating submission:", error);
    res.status(500).json({ error: error.message });
  }
};
