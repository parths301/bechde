"use client";

import { useState } from "react";
import Link from "next/link";
import { colors } from "@/lib/colors";
import { useAppState } from "@/lib/store";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export default function SignupPage() {
  const { radiusKm, setRadiusKm } = useAppState();
  const [name, setName] = useState("Aisha");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  /**
   * Redeemed on the server, not here. The browser client is PKCE-locked and can't
   * verify a plain 6-digit token — see src/app/api/auth/verify-code/route.ts. A hard
   * navigation afterwards so every hook re-reads the freshly written session cookie.
   */
  const verifyCode = async () => {
    if (code.length !== 6 || verifying) return;
    setVerifying(true);
    setError(null);
    const res = await fetch("/api/auth/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), token: code }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setVerifying(false);
      setError(body.error ?? "That code didn't work.");
      return;
    }
    window.location.href = "/home";
  };

  const sendLink = async () => {
    const addr = email.trim();
    if (!addr || sending) return;
    setSending(true);
    setError(null);
    const { error } = await getSupabaseBrowser().auth.signInWithOtp({
      email: addr,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
        data: name.trim() ? { name: name.trim() } : undefined,
      },
    });
    setSending(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <div
      className="bd-login-page"
      style={{
        minHeight: "100vh",
        // Flex, not grid. An auto grid track sizes to its item's max-content, so the
        // column became 960px wide and `maxWidth: 100%` then resolved against *that* —
        // the card stayed 960px on a 390px phone and hung two-thirds off the screen.
        // A flex container's content box is the real width, so the clamp bites.
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 30,
        background: "radial-gradient(circle at 20% 20%, #F6EEDD 0%, #FBF6ED 60%)",
      }}
    >
      <div
        className="bd-login-card"
        style={{
          width: 960,
          maxWidth: "100%",
          minWidth: 0,
          background: colors.bg,
          border: `1.5px solid ${colors.cardBorder}`,
          borderRadius: 26,
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(60,45,20,.12)",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
        }}
      >
        {/* Left panel */}
        <div
          className="bd-login-hero"
          style={{
            background: colors.ink,
            color: colors.bg,
            padding: "44px 40px",
            display: "flex",
            flexDirection: "column",
            gap: 22,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "11px 11px 11px 4px",
                background: colors.marigold,
                display: "grid",
                placeItems: "center",
                fontFamily: "var(--font-bricolage)",
                fontWeight: 800,
                fontSize: 18,
                color: colors.marigoldInk,
                transform: "rotate(-6deg)",
              }}
            >
              B
            </div>
            <div style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 22 }}>
              Bech De<span style={{ color: colors.terracotta }}>.</span>
            </div>
          </div>
          <h1
            className="bd-login-h1"
            style={{
              margin: "8px 0 0",
              fontFamily: "var(--font-bricolage)",
              fontWeight: 800,
              fontSize: 38,
              lineHeight: 1.12,
              letterSpacing: "-1px",
            }}
          >
            Your stuff has a
            <br />
            <span style={{ color: colors.marigold }}>second life</span> waiting
            <br />
            next door.
          </h1>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 14.5, lineHeight: 1.5, color: "rgba(251,246,237,.85)" }}>
            <div style={{ display: "flex", gap: 12 }}>🏠 Buy &amp; sell within your own neighbourhood</div>
            <div style={{ display: "flex", gap: 12 }}>💬 Chat, haggle, meet — no shipping drama</div>
            <div style={{ display: "flex", gap: 12 }}>✓ Verified neighbours only</div>
          </div>
          <div className="bd-login-rings" style={{ position: "absolute", right: -90, bottom: -90, width: 260, height: 260, borderRadius: "50%", border: "2px dashed rgba(242,169,59,.4)" }} />
          <div className="bd-login-rings" style={{ position: "absolute", right: -30, bottom: -30, width: 140, height: 140, borderRadius: "50%", border: "2px dashed rgba(242,169,59,.5)" }} />
        </div>

        {/* Right panel */}
        <div className="bd-login-form" style={{ padding: "44px 42px", display: "flex", flexDirection: "column", gap: 18, justifyContent: "center" }}>
          {sent ? (
            <div style={{ animation: "bd-pop .25s ease-out" }}>
              <h2 style={{ margin: "0 0 4px", fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 26, letterSpacing: "-.6px" }}>
                Check your email 📬
              </h2>
              <div style={{ fontSize: 13.5, color: colors.textMuted, fontWeight: 600, marginBottom: 22 }}>
                We sent a sign-in link to <b style={{ color: colors.ink }}>{email}</b>. Open it on this device to finish signing in.
              </div>
              {/* The link only works in *this* browser — PKCE ties it to the code
                  verifier stored here. Anyone reading the mail on their phone needs
                  the code, so it can't be buried as a fallback. */}
              <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 7 }}>
                Reading the email somewhere else? Enter the 6-digit code
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") verifyCode();
                  }}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  aria-label="Six-digit sign-in code"
                  placeholder="123456"
                  style={{
                    flex: 1,
                    minWidth: 130,
                    background: "#fff",
                    border: `1.5px solid ${colors.sand}`,
                    borderRadius: 12,
                    padding: "13px 16px",
                    fontFamily: "var(--font-bricolage)",
                    fontSize: 20,
                    fontWeight: 800,
                    letterSpacing: 4,
                    color: colors.ink,
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={verifyCode}
                  disabled={code.length !== 6 || verifying}
                  style={{
                    background: code.length === 6 ? colors.ink : colors.bg3,
                    color: code.length === 6 ? colors.bg : colors.textFaint,
                    border: "none",
                    borderRadius: 999,
                    padding: "13px 24px",
                    fontWeight: 800,
                    fontSize: 14.5,
                    fontFamily: "inherit",
                    cursor: code.length === 6 && !verifying ? "pointer" : "not-allowed",
                  }}
                >
                  {verifying ? "Checking…" : "Sign in"}
                </button>
              </div>
              {error && (
                <div style={{ fontSize: 13, fontWeight: 700, color: colors.terracotta, marginTop: 10 }}>{error}</div>
              )}
              <div
                style={{
                  marginTop: 16,
                  background: colors.sage,
                  border: `1.5px solid ${colors.sageBorder}`,
                  borderRadius: 14,
                  padding: "14px 18px",
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: colors.pine,
                  lineHeight: 1.5,
                }}
              >
                ✨ On this device, the link in the email signs you in with one tap.
              </div>
              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setCode("");
                  setError(null);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: 18,
                  background: "none",
                  border: "none",
                  fontFamily: "inherit",
                  textAlign: "center",
                  fontSize: 13,
                  fontWeight: 700,
                  color: colors.clay,
                  cursor: "pointer",
                }}
              >
                ← use a different email
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <h2 style={{ margin: "0 0 4px", fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 26, letterSpacing: "-.6px" }}>
                  Join in 30 seconds
                </h2>
                <div style={{ fontSize: 13.5, color: colors.textMuted, fontWeight: 600 }}>Just your email. No passwords to forget.</div>
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 7 }}>Email</div>
                <input
                  aria-label="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") sendLink();
                  }}
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  style={{
                    width: "100%",
                    background: "#fff",
                    border: `1.5px solid ${colors.sand}`,
                    borderRadius: 12,
                    padding: "13px 16px",
                    fontSize: 14.5,
                    fontWeight: 600,
                    color: colors.ink,
                    outline: "none",
                  }}
                />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 7 }}>What should we call you?</div>
                <input
                  aria-label="What should we call you?"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="First name is enough"
                  style={{
                    width: "100%",
                    background: "#fff",
                    border: `1.5px solid ${colors.sand}`,
                    borderRadius: 12,
                    padding: "13px 16px",
                    fontSize: 14.5,
                    fontWeight: 600,
                    color: colors.ink,
                    outline: "none",
                  }}
                />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 7 }}>Your neighbourhood</div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: colors.sage,
                    border: `1.5px solid ${colors.sageBorder}`,
                    borderRadius: 12,
                    padding: "13px 16px",
                    fontSize: 14,
                    fontWeight: 700,
                    color: colors.pine,
                  }}
                >
                  📍 Koramangala, Bengaluru <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>change</span>
                </div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
                  <span style={{ fontWeight: 800, fontSize: 13 }}>How far will you go for a deal?</span>
                  <span style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 15, color: colors.clay }}>{radiusKm} km</span>
                </div>
                <input type="range" aria-label="How far you'll go for a deal, in kilometres" min={1} max={10} value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} style={{ width: "100%", cursor: "pointer" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: colors.textFaint }}>
                  <span>my street</span>
                  <span>my whole city</span>
                </div>
              </div>
              {error && (
                <div style={{ fontSize: 13, fontWeight: 700, color: colors.terracotta }}>{error}</div>
              )}
              <PillButton label={sending ? "Sending…" : "Email me a link →"} onClick={sendLink} disabled={sending} />
              {/* The person who most needs the code is the one reading the email on a
                  second device — and they already have it. Without this they'd press
                  "email me a link" again, which GoTrue throttles to one send a minute,
                  and be told nothing useful. */}
              <button
                type="button"
                onClick={() => {
                  if (!email.trim()) {
                    setError("Enter your email first, then the code we sent you.");
                    return;
                  }
                  setError(null);
                  setSent(true);
                }}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  fontFamily: "inherit",
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: colors.clay,
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                I already have a code →
              </button>
              <div style={{ textAlign: "center", fontSize: 12, color: colors.textFaint, fontWeight: 600, lineHeight: 1.6 }}>
                By joining you agree to be a decent neighbour ✌️
                <br />
                and to our{" "}
                <Link href="/legal/terms" style={{ color: colors.clay, fontWeight: 700 }}>
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="/legal/privacy" style={{ color: colors.clay, fontWeight: 700 }}>
                  Privacy Policy
                </Link>
                .
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * A real <button>, not a styled div.
 *
 * It was a `<div onClick>`, which meant the primary action on the sign-in page — the
 * only way into the app — could not be reached with a keyboard at all. It escaped the
 * axe sweep because /login isn't in that spec's route list: the suite shares one
 * signed-in storageState and src/proxy.ts redirects an authenticated visitor away.
 * Same blind spot that let the card ship 960px wide on a phone.
 */
function PillButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "block",
        width: "100%",
        textAlign: "center",
        background: hover && !disabled ? colors.terracotta : colors.ink,
        color: colors.bg,
        border: "none",
        borderRadius: 999,
        padding: "15px 0",
        fontFamily: "inherit",
        fontWeight: 800,
        fontSize: 15.5,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {label}
    </button>
  );
}
