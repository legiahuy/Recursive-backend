// Pure mapping from a BoldSign webhook event to desired local state.
// No I/O — the service layer applies these to the database.

const EVENT_TO_DOC_STATUS = {
  Sent: "sent",
  Completed: "completed",
  Declined: "declined",
  Revoked: "voided",
  Expired: "expired",
};

const signerStatusFromBoldSign = (status) => {
  if (status === "Completed") return "signed";
  if (status === "Declined") return "declined";
  return "pending";
};

export const reduceEsignEvent = (eventType, signers = []) => ({
  documentStatus: EVENT_TO_DOC_STATUS[eventType] ?? null,
  signerStatuses: signers.map((s) => ({
    email: s.email,
    sign_status: signerStatusFromBoldSign(s.status),
  })),
});

export { EVENT_TO_DOC_STATUS };
