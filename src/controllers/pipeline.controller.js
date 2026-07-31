import crypto from "crypto";
import { supabase } from "../config/supabase.config.js";
import { canTransition, isValidStage } from "../domain/pipelineStages.js";
import { validateFormSubmission } from "../domain/formValidation.js";
import { sendPipelineInfoRequestEmail } from "../services/email.service.js";

const ITEM_FIELDS =
  "id, demo_submission_id, release_id, stage, track_title, agreed_release_date, " +
  "catalog_code, isrc, soundcloud_link, presave_link, cover_image_url, notes, " +
  "cancel_reason, stage_changed_at, created_at, updated_at";

const makeToken = () => crypto.randomBytes(24).toString("base64url");

const logEvent = async (itemId, fromStage, toStage, actorId, note) => {
  await supabase.from("pipeline_events").insert([{
    pipeline_item_id: itemId, from_stage: fromStage, to_stage: toStage,
    actor_user_id: actorId || null, note: note || null,
  }]);
};

export const getPipeline = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("pipeline_items")
      .select(`${ITEM_FIELDS}, pipeline_collaborators(id, name, email, form_status, submitted_at)`)
      .order("stage_changed_at", { ascending: true });
    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getPipelineItem = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("pipeline_items")
      .select(`${ITEM_FIELDS}, pipeline_collaborators(*), pipeline_events(*)`)
      .eq("id", req.params.id)
      .single();
    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createPipelineItem = async (req, res) => {
  const { track_title, artist_name, artist_email } = req.body || {};
  try {
    const { data: item, error } = await supabase.from("pipeline_items")
      .insert([{ stage: "accepted", track_title: track_title?.trim() || null }])
      .select("id").single();
    if (error) throw error;

    if (artist_name?.trim() && artist_email?.trim()) {
      const { error: collabErr } = await supabase.from("pipeline_collaborators").insert([{
        pipeline_item_id: item.id, name: artist_name.trim(), email: artist_email.trim(),
        form_token: makeToken(), form_status: "invited",
      }]);
      if (collabErr) console.error("Failed to seed collaborator on manual card:", collabErr.message);
    }

    const { data: full, error: fetchErr } = await supabase.from("pipeline_items")
      .select(`${ITEM_FIELDS}, pipeline_collaborators(id, name, email, form_status, submitted_at)`)
      .eq("id", item.id).single();
    if (fetchErr) throw fetchErr;
    res.status(201).json(full);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const EDITABLE = [
  "track_title", "agreed_release_date", "catalog_code", "isrc",
  "soundcloud_link", "presave_link", "cover_image_url", "notes",
];

export const updatePipelineItem = async (req, res) => {
  const { id } = req.params;
  const { stage, ...rest } = req.body;
  try {
    const { data: current, error: findErr } = await supabase
      .from("pipeline_items").select("stage").eq("id", id).single();
    if (findErr || !current) return res.status(404).json({ error: "Pipeline item not found" });

    const updates = {};
    for (const f of EDITABLE) if (rest[f] !== undefined) updates[f] = rest[f];

    let moved = false;
    if (stage !== undefined && stage !== current.stage) {
      if (!isValidStage(stage) || !canTransition(current.stage, stage)) {
        return res.status(400).json({ error: `Invalid transition ${current.stage} -> ${stage}` });
      }
      updates.stage = stage;
      updates.stage_changed_at = new Date().toISOString();
      moved = true;
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("pipeline_items").update(updates).eq("id", id).select().single();
    if (error) throw error;

    if (moved) await logEvent(id, current.stage, stage, req.userId, req.body.note);

    // Email timing: when a card enters "Info Requested", send the form-link
    // email to every collaborator still awaiting their form.
    if (moved && stage === "info_requested") {
      const { data: pending } = await supabase.from("pipeline_collaborators")
        .select("name, email, form_token")
        .eq("pipeline_item_id", id)
        .eq("form_status", "invited");
      for (const c of pending || []) {
        try {
          await sendPipelineInfoRequestEmail({
            to: c.email, artistName: c.name, trackTitle: data.track_title, token: c.form_token,
          });
        } catch (mailErr) {
          console.error("Failed to send info-request email on transition:", mailErr.message);
        }
      }
    }

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const cancelPipelineItem = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  if (!reason || !reason.trim()) return res.status(400).json({ error: "A cancel reason is required" });
  try {
    const { data: current, error: findErr } = await supabase
      .from("pipeline_items").select("stage").eq("id", id).single();
    if (findErr || !current) return res.status(404).json({ error: "Pipeline item not found" });
    if (current.stage === "cancelled") return res.status(400).json({ error: "Already cancelled" });

    const { data, error } = await supabase.from("pipeline_items")
      .update({ stage: "cancelled", cancel_reason: reason,
                stage_changed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", id).select().single();
    if (error) throw error;
    await logEvent(id, current.stage, "cancelled", req.userId, reason);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const addCollaborator = async (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;
  if (!name?.trim() || !email?.trim()) return res.status(400).json({ error: "name and email are required" });
  try {
    const { data: item, error: itemErr } = await supabase
      .from("pipeline_items").select("id, track_title, stage").eq("id", id).single();
    if (itemErr || !item) return res.status(404).json({ error: "Pipeline item not found" });

    const token = makeToken();
    const { data, error } = await supabase.from("pipeline_collaborators")
      .insert([{ pipeline_item_id: id, name, email, form_token: token, form_status: "invited" }])
      .select().single();
    if (error) throw error;

    // Only auto-send when invites for this card have already gone out
    // (i.e. the card is currently in "Info Requested"). Otherwise stay silent —
    // the admin sends manually via the resend button, or it goes out on the
    // Accepted -> Info Requested transition.
    if (item.stage === "info_requested") {
      try {
        await sendPipelineInfoRequestEmail({ to: email, artistName: name, trackTitle: item.track_title, token });
      } catch (mailErr) {
        console.error("Failed to send info-request email:", mailErr.message);
      }
    }
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const resendCollaborator = async (req, res) => {
  const { id, cid } = req.params;
  try {
    const { data: c, error } = await supabase.from("pipeline_collaborators")
      .select("name, email, form_token, pipeline_item_id").eq("id", cid).eq("pipeline_item_id", id).single();
    if (error || !c) return res.status(404).json({ error: "Collaborator not found" });
    const { data: item } = await supabase.from("pipeline_items").select("track_title").eq("id", id).single();
    await sendPipelineInfoRequestEmail({ to: c.email, artistName: c.name, trackTitle: item?.track_title, token: c.form_token });
    res.status(200).json({ message: "Invite resent" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const removeCollaborator = async (req, res) => {
  const { id, cid } = req.params;
  try {
    const { error } = await supabase.from("pipeline_collaborators")
      .delete().eq("id", cid).eq("pipeline_item_id", id);
    if (error) throw error;
    res.status(200).json({ message: "Collaborator removed" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getFormByToken = async (req, res) => {
  try {
    const { data: c, error } = await supabase.from("pipeline_collaborators")
      .select("name, email, form_status, form_data, pipeline_item_id").eq("form_token", req.params.token).single();
    if (error || !c) return res.status(404).json({ error: "Form not found" });
    const { data: item } = await supabase.from("pipeline_items")
      .select("track_title, cover_image_url").eq("id", c.pipeline_item_id).single();
    res.status(200).json({
      name: c.name, email: c.email, status: c.form_status,
      trackTitle: item?.track_title || null,
      referenceImageUrl: item?.cover_image_url || null,
      data: c.form_status === "submitted" ? c.form_data : null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const submitFormByToken = async (req, res) => {
  const { token } = req.params;
  try {
    const { data: c, error } = await supabase.from("pipeline_collaborators")
      .select("id, pipeline_item_id, form_status").eq("form_token", token).single();
    if (error || !c) return res.status(404).json({ error: "Form not found" });
    if (c.form_status === "submitted") return res.status(409).json({ error: "This form has already been submitted" });

    const { valid, errors } = validateFormSubmission(req.body);
    if (!valid) return res.status(400).json({ error: "Validation failed", details: errors });

    const { error: updErr } = await supabase.from("pipeline_collaborators")
      .update({ form_status: "submitted", form_data: req.body, submitted_at: new Date().toISOString() })
      .eq("id", c.id);
    if (updErr) throw updErr;

    const { data: siblings } = await supabase.from("pipeline_collaborators")
      .select("form_status").eq("pipeline_item_id", c.pipeline_item_id);
    const allSubmitted = siblings?.length > 0 && siblings.every((s) => s.form_status === "submitted");
    if (allSubmitted) {
      const { data: item } = await supabase.from("pipeline_items")
        .select("stage").eq("id", c.pipeline_item_id).single();
      if (item?.stage === "info_requested") {
        const { data: updated } = await supabase.from("pipeline_items")
          .update({ stage: "negotiation", stage_changed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", c.pipeline_item_id)
          .eq("stage", "info_requested")
          .select();
        if (updated && updated.length > 0) {
          await logEvent(c.pipeline_item_id, "info_requested", "negotiation", null, "All artist forms submitted");
        }
      }
    }
    res.status(200).json({ message: "Form submitted. Thank you!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export { logEvent };
