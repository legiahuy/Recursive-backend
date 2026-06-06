import { Resend } from "resend";
import { supabase } from "../config/supabase.config.js";

const resend = new Resend(process.env.RESEND_API_KEY);
const labelName = "Recursive Recordings";
const contactEmail = process.env.CONTACT_EMAIL || "contact.recursive@gmail.com";

const fallbackTemplates = {
  demo_acceptance: {
    subject: "Great news regarding your demo submission!",
    body: `
      <p>Hi {{artistName}},</p>
      <p>We have listened to your demo and we really like what we hear.</p>
      <p>We would love to discuss a potential release with you. Our team will reach out from {{contactEmail}} to discuss the release process and next steps.</p>
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
};

const renderTemplate = (template, values) =>
  template.replace(/{{\s*(artistName|labelName|contactEmail)\s*}}/g, (_, key) => {
    return values[key] || "";
  });

export const sendEmail = async (to, subject, html) => {
  try {
    const data = await resend.emails.send({
      from:
        process.env.EMAIL_FROM ||
        "Recursive Recordings <noreply@demos.recursiverecordings.com>",
      to: [to],
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
}) => {
  const template = await getDemoEmailTemplate(templateKey);
  const values = {
    artistName: artistName || "Artist",
    labelName,
    contactEmail,
  };
  const renderedSubject = renderTemplate(subject || template.subject, values);
  const renderedBody = renderTemplate(message || template.body, values);

  return sendEmail(to, renderedSubject, renderedBody);
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
