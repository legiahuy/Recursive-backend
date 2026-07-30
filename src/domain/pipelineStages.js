export const STAGES = [
  "accepted", "info_requested", "negotiation", "contract_sent",
  "signed", "artwork", "distribution", "assets_presave", "released",
];

const ALL = new Set([...STAGES, "cancelled"]);

export const isValidStage = (stage) => ALL.has(stage);

export const canTransition = (from, to) => {
  if (!isValidStage(from) || !isValidStage(to)) return false;
  if (from === "cancelled") return false;
  if (to === "cancelled") return true;
  return true; // any ordered stage -> any ordered stage (incl. no-op)
};

export const nextStage = (stage) => {
  const i = STAGES.indexOf(stage);
  if (i === -1 || i === STAGES.length - 1) return null;
  return STAGES[i + 1];
};
