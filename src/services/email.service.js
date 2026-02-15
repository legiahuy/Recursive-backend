import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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

export const sendRejectionEmail = async (to, artistName) => {
  const subject = "Update on your demo submission to Recursive Recordings";
  const html = `
    <p>Hi ${artistName},</p>
    <p>Thank you for sending us your demo. We appreciate the time and effort you put into your music.</p>
    <p>After careful consideration, we have decided not to move forward with this specific release. Please understand that this is not a reflection on your talent, but rather a decision based on our current schedule and curatorial direction.</p>
    <p>We wish you the best of luck with your music and encourage you to submit again in the future.</p>
    <p>Best regards,<br/>Recursive Recordings Team</p>
  `;
  return sendEmail(to, subject, html);
};

export const sendAcceptanceEmail = async (to, artistName, customMessage) => {
  const subject = "Great news regarding your demo submission!";
  const defaultMessage = `
    <p>Hi ${artistName},</p>
    <p>We've listened to your demo and we really like what we hear!</p>
    <p>We would love to discuss a potential release with you. Our team will reach out to you soon via our contact email to discuss the release process and next steps.</p>
    <p>Cheers,<br/>Recursive Recordings Team</p>
  `;

  const html = customMessage
    ? `<p>Hi ${artistName},</p>${customMessage}<p>Best,<br/>Recursive Team</p>`
    : defaultMessage;

  return sendEmail(to, subject, html);
};
