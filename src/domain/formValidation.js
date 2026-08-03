const isHttpUrl = (v) => {
  if (typeof v !== "string") return false;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

const nonEmpty = (v) => typeof v === "string" && v.trim().length > 0;

// Audio deliverables must live on a permanent host. Only Google Drive and
// Dropbox are accepted — expiring senders like WeTransfer are rejected.
const isAllowedAudioHost = (v) => {
  if (typeof v !== "string") return false;
  try {
    const host = new URL(v).hostname.toLowerCase();
    return (
      host === "drive.google.com" ||
      host.endsWith(".drive.google.com") ||
      host === "dropbox.com" ||
      host.endsWith(".dropbox.com")
    );
  } catch {
    return false;
  }
};

const validateDsp = (key, entry, errors, { required = false, mustHaveUrl = false } = {}) => {
  const e = entry || {};
  if (mustHaveUrl) {
    // No "create new" option — a real profile URL is always required.
    if (!isHttpUrl(e.url)) errors.push(`dsp.${key}: a valid profile URL is required`);
    return;
  }
  if (e.has === true) {
    if (!isHttpUrl(e.url)) errors.push(`dsp.${key}: valid profile URL required`);
  } else if (e.createNew === true) {
    // ok — will create a new profile
  } else {
    if (required) errors.push(`dsp.${key}: ${key} is required (link or create new)`);
    else errors.push(`dsp.${key}: choose a profile link or "create new"`);
  }
};

export const validateFormSubmission = (data) => {
  const errors = [];
  const d = data || {};

  for (const f of ["legal_name", "artist_name", "country", "track_title", "genre", "role", "bio", "press_photo_url"]) {
    if (!nonEmpty(d[f])) errors.push(`${f}: required`);
  }

  const split = Number(d.split_percent);
  if (!Number.isFinite(split) || split < 0 || split > 100) {
    errors.push("split_percent: must be a number between 0 and 100");
  }

  if (d.rights_attestation !== true) errors.push("rights_attestation: must be accepted");

  // Audio download link — required, and restricted to Google Drive / Dropbox.
  if (!nonEmpty(d.audio_link)) {
    errors.push("audio_link: required");
  } else if (!isHttpUrl(d.audio_link)) {
    errors.push("audio_link: must be a valid http(s) URL");
  } else if (!isAllowedAudioHost(d.audio_link)) {
    errors.push("audio_link: must be a Google Drive or Dropbox link (no expiring links)");
  }

  const dsp = d.dsp || {};
  validateDsp("spotify", dsp.spotify, errors);
  validateDsp("apple", dsp.apple, errors);
  validateDsp("soundcloud", dsp.soundcloud, errors, { required: true, mustHaveUrl: true });

  // YouTube is optional — validate only when a value is provided.
  if (nonEmpty(d.youtube_url) && !isHttpUrl(d.youtube_url)) {
    errors.push("youtube_url: must be a valid http(s) URL");
  }

  const ig = d.instagram || {};
  if (ig.notUsed !== true && !isHttpUrl(ig.url)) {
    errors.push('instagram: valid URL or "I don\'t use Instagram" required');
  }

  return { valid: errors.length === 0, errors };
};
