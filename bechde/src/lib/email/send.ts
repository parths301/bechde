import "server-only";

/**
 * Outbound email, behind one interface.
 *
 * The rule this file exists to enforce: **a send that cannot happen throws.** The
 * function it replaces did `console.log("[EMAIL] To: …")` and then stamped
 * last_notified_at as though a message had gone out, so the digest feature reported
 * success for months while sending nothing. That is the same failure shape as the seed
 * that ignored `error` (README.md §4), and the cure is the same: refuse to continue.
 *
 * Provider is Resend. The adapter is small and isolated here so swapping it is one
 * file, but there is no "log instead" mode — that mode is what caused the bug.
 */
export interface Mail {
  to: string;
  subject: string;
  html: string;
  /** List-Unsubscribe and friends. Required on anything bulk. */
  headers?: Record<string, string>;
}

const KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM ?? "Bech De <hello@bechde.app>";

/** Whether email can actually be sent. Callers use this to *skip* work, never to fake it. */
export const emailConfigured = !!KEY;

export async function sendMail(mail: Mail): Promise<void> {
  if (!KEY) {
    throw new Error(
      "RESEND_API_KEY is not set — refusing to pretend an email was sent. " +
        "Set it, or don't call the sender."
    );
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [mail.to],
      subject: mail.subject,
      html: mail.html,
      headers: mail.headers,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend rejected the message (${res.status}): ${detail.slice(0, 300)}`);
  }
}
