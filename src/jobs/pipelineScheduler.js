import { supabase } from "../config/supabase.config.js";

const flipDueReleases = async () => {
  const today = new Date().toISOString().slice(0, 10);
  const { data: due, error } = await supabase
    .from("pipeline_items").select("id, stage")
    .lte("agreed_release_date", today)
    .not("stage", "in", "(released,cancelled)");
  if (error) return console.error("pipeline scheduler:", error.message);
  for (const item of due || []) {
    await supabase.from("pipeline_items")
      .update({ stage: "released", stage_changed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", item.id);
    await supabase.from("pipeline_events").insert([{
      pipeline_item_id: item.id, from_stage: item.stage, to_stage: "released",
      actor_user_id: null, note: "Auto-released on release date",
    }]);
  }
};

export const startPipelineScheduler = () => {
  flipDueReleases();
  setInterval(flipDueReleases, 6 * 60 * 60 * 1000);
};
