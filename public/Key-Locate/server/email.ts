// Email delivery via Brevo (free tier: 300 emails/day). Falls back to
// SendGrid if BREVO_API_KEY is not set. The sender address comes from
// SENDGRID_FROM_EMAIL (kept for continuity) and must be a verified sender
// in the active provider's dashboard.
import sgMail from "@sendgrid/mail";

const brevoApiKey = process.env.BREVO_API_KEY;
const sendgridApiKey = process.env.SENDGRID_API_KEY;
// FROM_EMAIL (if set) overrides the default sender — must be a verified
// sender in the active email provider (Brevo/SendGrid).
const fromEmail = process.env.FROM_EMAIL || process.env.SENDGRID_FROM_EMAIL;

if (sendgridApiKey) {
  sgMail.setApiKey(sendgridApiKey);
}
if (!brevoApiKey && !sendgridApiKey) {
  console.warn("[email] Neither BREVO_API_KEY nor SENDGRID_API_KEY is set — outbound emails will fail.");
}

export function isEmailConfigured(): boolean {
  return Boolean((brevoApiKey || sendgridApiKey) && fromEmail);
}

async function sendViaBrevo(to: string, subject: string, text: string, html: string): Promise<void> {
  const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": brevoApiKey!,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: fromEmail, name: "keylocate" },
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Brevo send failed (${resp.status}): ${body}`);
  }
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  firstName?: string | null,
): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error("Email is not configured (missing API key or sender email)");
  }

  const name = firstName?.trim() || "there";
  const subject = "Reset your keylocate password";
  const text = `Hi ${name},

We received a request to reset your keylocate password. Click the link below to set a new password. This link will expire in 60 minutes and can only be used once.

${resetUrl}

If you did not request a password reset, you can safely ignore this email — your password will not be changed.

— The keylocate team`;

  const html = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111827;">
    <h2 style="margin: 0 0 16px; color: #111827;">Reset your keylocate password</h2>
    <p style="font-size: 15px; line-height: 1.5;">Hi ${escapeHtml(name)},</p>
    <p style="font-size: 15px; line-height: 1.5;">
      We received a request to reset your keylocate password. Click the button below to choose a new one.
      This link will expire in <strong>60 minutes</strong> and can only be used once.
    </p>
    <p style="margin: 28px 0;">
      <a href="${resetUrl}"
         style="background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block;">
        Reset password
      </a>
    </p>
    <p style="font-size: 13px; color:#6b7280; line-height: 1.5;">
      Or copy this link into your browser:<br/>
      <a href="${resetUrl}" style="color:#2563eb;word-break:break-all;">${escapeHtml(resetUrl)}</a>
    </p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
    <p style="font-size: 12px; color:#6b7280;">
      If you did not request a password reset, you can safely ignore this email — your password will not be changed.
    </p>
  </div>`;

  if (brevoApiKey) {
    await sendViaBrevo(to, subject, text, html);
  } else {
    await sgMail.send({
      to,
      from: fromEmail!,
      subject,
      text,
      html,
    });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
