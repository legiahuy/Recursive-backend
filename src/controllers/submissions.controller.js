import { supabase } from "../config/supabase.config.js";

export const createSubmission = async (req, res) => {
  const {
    artist_name,
    email,
    stream_link,
    note,
    bio,
    genre,
    country,
    social_link,
    consent = false,
    website,
  } = req.body;

  if (website) {
    return res.status(201).json({ status: "received" });
  }

  try {
    const { data, error } = await supabase
      .from("demo_submissions")
      .insert([
        {
          artist_name,
          email,
          stream_link,
          note: note || bio,
          genre,
          country,
          social_link,
          consent,
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
  sendDemoStatusEmail,
} from "../services/email.service.js";

export const updateSubmissionStatus = async (req, res) => {
  const { id } = req.params;
  const {
    status,
    note,
    internal_note,
    sendEmail,
    emailSubject,
    emailMessage,
    templateKey,
  } = req.body;

  try {
    const updates = {};
    if (status !== undefined) updates.status = status;
    if (note !== undefined) updates.note = note;
    if (internal_note !== undefined) updates.internal_note = internal_note;

    const { data, error } = await supabase
      .from("demo_submissions")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    const artistName = data.artist_name || "Artist";
    const email = data.email;
    const resolvedTemplateKey =
      templateKey ||
      (status === "accepted"
        ? "demo_acceptance"
        : status === "rejected"
          ? "demo_rejection"
          : status === "contacted"
            ? "demo_contacted"
            : undefined);

    if (email && sendEmail && resolvedTemplateKey) {
      await sendDemoStatusEmail({
        to: email,
        artistName,
        templateKey: resolvedTemplateKey,
        subject: emailSubject,
        message: emailMessage,
      });
    }

    res.json(data);
  } catch (error) {
    console.error("Error updating submission:", error);
    res.status(500).json({ error: error.message });
  }
};
