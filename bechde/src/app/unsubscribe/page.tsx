import { colors } from "@/lib/colors";
import { createPublicClient } from "@/lib/supabase/server";
import Link from "next/link";

/**
 * Unsubscribe, without signing in.
 *
 * That constraint is the whole design. Someone who wants your email to stop is the
 * least likely person to log in to make it stop, and every bulk sender is expected to
 * honour a one-click List-Unsubscribe. The token in the URL is a capability: it proves
 * only "holds this person's link", which is exactly the authority to mute their mail
 * and nothing else. A profile id here would let anyone mute anyone.
 *
 * A server component so the click in the email is the whole interaction — no
 * JavaScript, no second confirmation, which is what one-click means.
 */
export const dynamic = "force-dynamic";

const KINDS: Record<string, string> = {
  messages: "emails about new messages",
  saved_searches: "saved-search alerts",
  all: "all email from Bech De",
};

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; k?: string }>;
}) {
  const { t, k } = await searchParams;
  const kind = k && k in KINDS ? k : "all";

  let ok = false;
  if (t) {
    // Anon client: unsubscribe_by_token is SECURITY DEFINER precisely so this needs
    // no privileged key on a public page.
    const { data } = await createPublicClient().rpc("unsubscribe_by_token", {
      p_token: t,
      p_kind: kind,
    });
    ok = data === true;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: colors.bg,
      }}
    >
      <div
        style={{
          background: "#fff",
          border: `1.5px solid ${colors.cardBorder}`,
          borderRadius: 20,
          padding: "30px 28px",
          maxWidth: 460,
          minWidth: 0,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 34, marginBottom: 10 }}>{ok ? "🔕" : "🤔"}</div>
        <h1 style={{ margin: "0 0 10px", fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 24 }}>
          {ok ? "Done — that's off" : "That link didn't work"}
        </h1>
        <p style={{ margin: "0 0 18px", fontSize: 14.5, lineHeight: 1.6, color: colors.textBody, fontWeight: 600 }}>
          {ok ? (
            <>
              You won&apos;t get {KINDS[kind]} any more. Chats still work — you just won&apos;t be emailed about
              them. You can turn this back on any time from your profile.
            </>
          ) : (
            <>
              The link may have expired or been altered. You can change every notification setting from your
              profile once you&apos;re signed in.
            </>
          )}
        </p>
        <Link
          href="/profile"
          style={{
            display: "inline-block",
            background: colors.ink,
            color: colors.bg,
            borderRadius: 999,
            padding: "12px 24px",
            fontWeight: 800,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          Notification settings
        </Link>
      </div>
    </div>
  );
}
