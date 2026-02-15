import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "465"),
  secure: process.env.SMTP_SECURE === "true" || true, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendEmail = async (to, subject, html) => {
  try {
    const info = await transporter.sendMail({
      from: `"Recursive Recordings" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log("Message sent: %s", info.messageId);
    return info;
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
    <p>We would love to discuss a potential release with you. Please reply to this email so we can take the next steps.</p>
    <p>Cheers,<br/>Recursive Recordings Team</p>
  `;

  const html = customMessage
    ? `<p>Hi ${artistName},</p>${customMessage}<p>Best,<br/>Recursive Team</p>`
    : defaultMessage;

  return sendEmail(to, subject, html);
};
