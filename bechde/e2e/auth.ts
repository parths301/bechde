import { Page, expect } from "@playwright/test";

const MAILPIT = "http://127.0.0.1:54324";

/**
 * Sign in through the real magic-link flow: fill the form, then pull the link out
 * of Mailpit (the local stack's mail catcher) and follow it, exactly as a user
 * would from their inbox.
 */
export async function signIn(page: Page, email: string) {
  // Empty the mailbox first. Otherwise a leftover email from an earlier run is
  // picked up instead of this one, and its token has already been consumed —
  // which surfaces as a baffling "Email link is invalid or has expired".
  await fetch(`${MAILPIT}/api/v1/messages`, { method: "DELETE" });

  await page.goto("/");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByText("Email me a link →").click();
  await expect(page.getByText("Check your email")).toBeVisible();

  const link = await waitForMagicLink(email);
  await page.goto(link);
  await page.waitForURL(/\/home/);
}

/**
 * The email carries GoTrue's ConfirmationURL (…/auth/v1/verify?token=…). Following
 * it lets GoTrue verify the token and bounce back to /auth/confirm with ?code=,
 * which is what the app's PKCE flow expects — so this exercises the real path a
 * user takes, not a shortcut.
 */
async function waitForMagicLink(email: string, attempts = 20): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const list = await fetch(`${MAILPIT}/api/v1/messages?limit=30`).then((r) => r.json());
    const msg = list.messages?.find((m: { To: { Address: string }[] }) => m.To.some((t) => t.Address === email));
    if (msg) {
      // Parse the JSON rather than regexing the raw response — quotes are escaped
      // in the payload, so `href="…"` never matches the wire format.
      const mail = (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`).then((r) => r.json())) as {
        HTML?: string;
        Text?: string;
      };
      const href = `${mail.HTML ?? ""}${mail.Text ?? ""}`.match(/href="(https?:\/\/[^"]*verify[^"]*)"/)?.[1];
      if (href) return href.replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no magic link arrived for ${email} — is the local stack running?`);
}
