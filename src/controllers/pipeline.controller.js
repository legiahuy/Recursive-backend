import { supabase } from "../config/supabase.config.js";
import { canTransition, isValidStage } from "../domain/pipelineStages.js";

const ITEM_FIELDS =
  "id, demo_submission_id, release_id, stage, track_title, agreed_release_date, " +
  "catalog_code, isrc, soundcloud_link, presave_link, cover_image_url, notes, " +
  "cancel_reason, stage_changed_at, created_at, updated_at";

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

export { logEvent };
