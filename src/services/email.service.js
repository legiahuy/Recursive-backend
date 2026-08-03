import { Resend } from "resend";
import { supabase } from "../config/supabase.config.js";

const resend = new Resend(process.env.RESEND_API_KEY);
const labelName = "Recursive Recordings";
const contactEmail = process.env.CONTACT_EMAIL || "contact.recursive@gmail.com";
const replyToEmail = process.env.EMAIL_REPLY_TO || contactEmail;
const siteUrl = process.env.SITE_URL || "https://www.recursiverecordings.com";

const fallbackTemplates = {
  demo_received: {
    subject: "We received your demo — Recursive Recordings",
    body: `
      <p>Hi {{artistName}},</p>
      <p>Thanks for sending your demo to {{labelName}}. It's landed with our A&amp;R team and it's in the queue.</p>
      <p>Your reference is <strong>{{referenceCode}}</strong>. Keep it safe — you can check where your submission stands at any time:</p>
      <p><a href="{{statusUrl}}">Track your submission status</a></p>
      <p>We listen to everything ourselves, so it takes time. Expect to hear back within about four weeks. If it's a fit, we'll reach out from {{contactEmail}} to talk next steps.</p>
      <p>Cheers,<br/>{{labelName}} Team</p>
    `,
  },
  demo_acceptance: {
    subject: "Great news regarding your demo submission!",
    body: `
      <p>Hi {{artistName}},</p>
      <p>We have listened to your demo and we really like what we hear.</p>
      <p>We would love to release your track. To get started, please complete a quick intake form with your track title and any collaborators (their name and email) so we can prepare your release forms:</p>
      <p><a href="{{intakeUrl}}">Start your release intake</a></p>
      <p>Once you submit, our team will reach out from {{contactEmail}} with the next steps.</p>
      <p>Cheers,<br/>{{labelName}} Team</p>
    `,
  },
  demo_rejection: {
    subject: "Update on your demo submission to Recursive Recordings",
    body: `
      <p>Hi {{artistName}},</p>
      <p>Thank you for sending us your demo. We appreciate the time and effort you put into your music.</p>
      <p>After careful consideration, we have decided not to move forward with this specific release. Please understand that this is not a reflection on your talent, but rather a decision based on our current schedule and curatorial direction.</p>
      <p>We wish you the best of luck with your music and encourage you to submit again in the future.</p>
      <p>Best regards,<br/>{{labelName}} Team</p>
    `,
  },
  demo_contacted: {
    subject: "Next steps for your Recursive Recordings demo",
    body: `
      <p>Hi {{artistName}},</p>
      <p>Thanks for sending your demo to {{labelName}}. We would like to continue the conversation and learn more about the track.</p>
      <p>Please reply to this email or contact us at {{contactEmail}} with any extra release context, socials, and availability.</p>
      <p>Best,<br/>{{labelName}} Team</p>
    `,
  },
  pipeline_info_request: {
    subject: "{{artistName}} – {{trackTitle}} (Recursive Recordings)",
    body: `
      <p>Hi {{artistName}},</p>
      <p>Congrats — we'd love to release <strong>{{trackTitle}}</strong> on {{labelName}}. Please complete your artist info form so we can prepare everything:</p>
      <p><a href="{{formUrl}}">Complete your artist form</a></p>
      <p>Any questions, just reply to this email.</p>
      <p>— {{labelName}}</p>
    `,
  },
};

const renderTemplate = (template, values) =>
  template.replace(
    /{{\s*(artistName|labelName|contactEmail|referenceCode|statusUrl|trackTitle|formUrl|intakeUrl)\s*}}/g,
    (_, key) => {
      return values[key] || "";
    },
  );

const buildStatusUrl = (referenceCode, email) => {
  const params = new URLSearchParams({ ref: referenceCode, email });
  return `${siteUrl.replace(/\/$/, "")}/demo/status?${params.toString()}`;
};

const buildIntakeUrl = (token) =>
  `${siteUrl.replace(/\/$/, "")}/release-intake/${token}`;

export const sendEmail = async (to, subject, html) => {
  try {
    const data = await resend.emails.send({
      from:
        process.env.EMAIL_FROM ||
        "Recursive Recordings <noreply@demos.recursiverecordings.com>",
      to: [to],
      replyTo: replyToEmail,
      subject,
      html,
    });
    console.log("Email sent successfully:", data.id);
    return data;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

export const getDemoEmailTemplate = async (templateKey) => {
  try {
    const { data, error } = await supabase
      .from("email_templates")
      .select("subject, body")
      .eq("template_key", templateKey)
      .single();

    if (error) throw error;

    return data || fallbackTemplates[templateKey];
  } catch (error) {
    console.warn("Using fallback email template:", templateKey, error.message);
    return fallbackTemplates[templateKey];
  }
};

export const sendDemoStatusEmail = async ({
  to,
  artistName,
  templateKey,
  subject,
  message,
  referenceCode,
  intakeToken,
}) => {
  const template = await getDemoEmailTemplate(templateKey);
  const values = {
    artistName: artistName || "Artist",
    labelName,
    contactEmail,
    referenceCode: referenceCode || "",
    statusUrl: referenceCode ? buildStatusUrl(referenceCode, to) : "",
    intakeUrl: intakeToken ? buildIntakeUrl(intakeToken) : "",
  };
  const renderedSubject = renderTemplate(subject || template.subject, values);
  const renderedBody = renderTemplate(message || template.body, values);

  return sendEmail(to, renderedSubject, renderedBody);
};

export const sendDemoConfirmationEmail = async ({
  to,
  artistName,
  referenceCode,
}) => {
  return sendDemoStatusEmail({
    to,
    artistName,
    templateKey: "demo_received",
    referenceCode,
  });
};

const buildFormUrl = (token) =>
  `${siteUrl.replace(/\/$/, "")}/release-form/${token}`;

export const sendPipelineInfoRequestEmail = async ({
  to,
  artistName,
  trackTitle,
  token,
}) => {
  const template = await getDemoEmailTemplate("pipeline_info_request");
  const values = {
    artistName: artistName || "Artist",
    trackTitle: trackTitle || "your track",
    labelName,
    contactEmail,
    formUrl: buildFormUrl(token),
  };
  const subject = renderTemplate(template.subject, values);
  const body = renderTemplate(template.body, values);
  return sendEmail(to, subject, body);
};

export const sendRejectionEmail = async (to, artistName) => {
  return sendDemoStatusEmail({
    to,
    artistName,
    templateKey: "demo_rejection",
  });
};

export const sendAcceptanceEmail = async (to, artistName, customMessage) => {
  return sendDemoStatusEmail({
    to,
    artistName,
    templateKey: "demo_acceptance",
    message: customMessage,
  });
};
