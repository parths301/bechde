import { colors } from "@/lib/colors";

/**
 * Email templates. Plain inline-styled HTML — every mail client strips <style> blocks,
 * and half of them still lay out with tables, so this stays deliberately simple rather
 * than reaching for the brand's full typography.
 */

interface Shell {
  heading: string;
  body: string;
  cta?: { label: string; href: string };
  unsubscribeUrl: string;
  /** What this particular email is, so the footer can say which switch turns it off. */
  about: string;
}

export function shell({ heading, body, cta, unsubscribeUrl, about }: Shell): string {
  return `
<div style="background:${colors.bg};padding:28px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${colors.ink}">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid ${colors.cardBorder};border-radius:18px;padding:28px 26px">
    <div style="font-weight:800;font-size:19px;margin-bottom:14px">Bech De<span style="color:${colors.terracotta}">.</span></div>
    <h1 style="margin:0 0 12px;font-size:21px;font-weight:800;line-height:1.25">${heading}</h1>
    <div style="font-size:14.5px;line-height:1.6;color:${colors.textBody}">${body}</div>
    ${
      cta
        ? `<p style="margin:22px 0 0"><a href="${cta.href}" style="display:inline-block;background:${colors.ink};color:${colors.bg};font-weight:700;padding:12px 22px;border-radius:999px;text-decoration:none">${cta.label}</a></p>`
        : ""
    }
  </div>
  <div style="max-width:520px;margin:14px auto 0;font-size:12px;color:${colors.textFaint};line-height:1.5;text-align:center">
    ${about}<br>
    <a href="${unsubscribeUrl}" style="color:${colors.textFaint}">Turn these off</a>
  </div>
</div>`.trim();
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function newMessagesEmail(args: {
  siteUrl: string;
  unsubscribeUrl: string;
  threads: { listing: string; from: string; preview: string; chatId: string }[];
}): { subject: string; html: string } {
  const n = args.threads.length;
  const subject = n === 1 ? `${args.threads[0].from} messaged you about ${args.threads[0].listing}` : `${n} new messages on Bech De`;

  const body = args.threads
    .map(
      (t) => `
      <div style="border-top:1px dashed ${colors.divider};padding:12px 0">
        <div style="font-weight:700">${esc(t.from)} · <span style="font-weight:600;color:${colors.textMuted}">${esc(t.listing)}</span></div>
        <div style="color:${colors.textBody}">“${esc(t.preview)}”</div>
      </div>`
    )
    .join("");

  return {
    subject,
    html: shell({
      heading: n === 1 ? "You have a message" : `You have ${n} messages`,
      body,
      cta: { label: "Reply on Bech De", href: `${args.siteUrl}/chat` },
      unsubscribeUrl: args.unsubscribeUrl,
      about: "You're getting this because someone messaged you about a listing.",
    }),
  };
}

export function savedSearchEmail(args: {
  siteUrl: string;
  unsubscribeUrl: string;
  query: string;
  matches: { name: string; price: string; id: string }[];
}): { subject: string; html: string } {
  const n = args.matches.length;
  const subject = `${n} new ${n === 1 ? "match" : "matches"} for “${args.query}”`;

  const body = args.matches
    .slice(0, 8)
    .map(
      (m) => `
      <div style="border-top:1px dashed ${colors.divider};padding:10px 0">
        <a href="${args.siteUrl}/product/${encodeURIComponent(m.id)}" style="color:${colors.ink};text-decoration:none;font-weight:700">${esc(m.name)}</a>
        <span style="color:${colors.clay};font-weight:800"> · ${esc(m.price)}</span>
      </div>`
    )
    .join("");

  return {
    subject,
    html: shell({
      heading: `New near you: ${esc(args.query)}`,
      body: body + (n > 8 ? `<div style="padding-top:10px;color:${colors.textMuted}">…and ${n - 8} more.</div>` : ""),
      cta: { label: "See them all", href: `${args.siteUrl}/search?q=${encodeURIComponent(args.query)}` },
      unsubscribeUrl: args.unsubscribeUrl,
      about: `You saved a search for “${esc(args.query)}”.`,
    }),
  };
}
