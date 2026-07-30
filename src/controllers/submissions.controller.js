import crypto from "crypto";
import { supabase } from "../config/supabase.config.js";
import {
  sendDemoStatusEmail,
  sendDemoConfirmationEmail,
} from "../services/email.service.js";

const PUBLIC_STATUS_LABELS = {
  pending: "Received",
  reviewed: "Under review",
  contacted: "In conversation",
  accepted: "Accepted",
  rejected: "Not this time",
};

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

    if (data?.email) {
      try {
        await sendDemoConfirmationEmail({
          to: data.email,
          artistName: data.artist_name,
          referenceCode: data.id,
        });
      } catch (emailError) {
        console.error(
          "Failed to send demo confirmation email:",
          emailError.message,
        );
      }
    }

    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getSubmissionStatus = async (req, res) => {
  const { ref, email } = req.query;

  if (!ref || !email) {
    return res
      .status(400)
      .json({ error: "Both a reference and email are required." });
  }

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      String(ref).trim(),
    );

  if (!isUuid) {
    return res.status(404).json({
      error: "No submission matches that reference and email.",
    });
  }

  try {
    const { data, error } = await supabase
      .from("demo_submissions")
      .select("artist_name, email, status, created_at")
      .eq("id", String(ref).trim())
      .maybeSingle();

    if (error) throw error;

    const matches =
      data &&
      typeof data.email === "string" &&
      data.email.trim().toLowerCase() === String(email).trim().toLowerCase();

    if (!matches) {
      return res.status(404).json({
        error: "No submission matches that reference and email.",
      });
    }

    res.json({
      artist_name: data.artist_name,
      status: data.status,
      status_label: PUBLIC_STATUS_LABELS[data.status] || "Received",
      created_at: data.created_at,
    });
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

    // On acceptance, create a pipeline item + seed the first collaborator (idempotent).
    if (status === "accepted") {
      const { data: existing } = await supabase
        .from("pipeline_items").select("id").eq("demo_submission_id", id).maybeSingle();
      if (!existing) {
        const { data: pipelineItem } = await supabase.from("pipeline_items")
          .insert([{ demo_submission_id: id, stage: "accepted", track_title: null }])
          .select().single();
        if (pipelineItem) {
          await supabase.from("pipeline_collaborators").insert([{
            pipeline_item_id: pipelineItem.id,
            name: data.artist_name || "Artist",
            email: data.email,
            form_token: crypto.randomBytes(24).toString("base64url"),
            form_status: "invited",
          }]);
        }
      }
    }

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
