const isEmail = (v) =>
  typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

const nonEmpty = (v) => typeof v === "string" && v.trim().length > 0;

export const validateIntake = (body, { existingEmails = [] } = {}) => {
  const errors = [];
  const b = body || {};

  const trackTitle = typeof b.track_title === "string" ? b.track_title.trim() : "";
  if (!nonEmpty(trackTitle)) errors.push("track_title: required");

  const skip = new Set(existingEmails.map((e) => String(e).trim().toLowerCase()));
  const seen = new Set();
  const collaborators = [];
  const rawCollaborators = Array.isArray(b.collaborators) ? b.collaborators : [];

  rawCollaborators.forEach((c, i) => {
    const name = typeof c?.name === "string" ? c.name.trim() : "";
    const email = typeof c?.email === "string" ? c.email.trim() : "";
    const emailKey = email.toLowerCase();

    if (!nonEmpty(name)) errors.push(`collaborators[${i}].name: required`);
    if (!isEmail(email)) errors.push(`collaborators[${i}].email: valid email required`);
    if (errors.length) return;

    if (skip.has(emailKey) || seen.has(emailKey)) return; // primary or intra-dupe
    seen.add(emailKey);
    collaborators.push({ name, email: emailKey });
  });

  return {
    valid: errors.length === 0,
    errors,
    normalized: { trackTitle, collaborators },
  };
};
