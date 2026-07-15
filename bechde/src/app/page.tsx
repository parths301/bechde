"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { colors } from "@/lib/colors";
import { useAppState } from "@/lib/store";

export default function SignupPage() {
  const router = useRouter();
  const { name, setName, phone, setPhone, radiusKm, setRadiusKm } = useAppState();
  const [otpStage, setOtpStage] = useState(false);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 30,
        background: "radial-gradient(circle at 20% 20%, #F6EEDD 0%, #FBF6ED 60%)",
      }}
    >
      <div
        style={{
          width: 960,
          maxWidth: "100%",
          background: colors.bg,
          border: `1.5px solid ${colors.cardBorder}`,
          borderRadius: 26,
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(60,45,20,.12)",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
        }}
      >
        {/* Left panel */}
        <div
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
            <div style={{ display: "flex", gap: 12 }}>✓ Phone-verified people only</div>
          </div>
          <div style={{ position: "absolute", right: -90, bottom: -90, width: 260, height: 260, borderRadius: "50%", border: "2px dashed rgba(242,169,59,.4)" }} />
          <div style={{ position: "absolute", right: -30, bottom: -30, width: 140, height: 140, borderRadius: "50%", border: "2px dashed rgba(242,169,59,.5)" }} />
        </div>

        {/* Right panel */}
        <div style={{ padding: "44px 42px", display: "flex", flexDirection: "column", gap: 18, justifyContent: "center" }}>
          {otpStage ? (
            <div style={{ animation: "bd-pop .25s ease-out" }}>
              <h2 style={{ margin: "0 0 4px", fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 26, letterSpacing: "-.6px" }}>
                Check your phone 📲
              </h2>
              <div style={{ fontSize: 13.5, color: colors.textMuted, fontWeight: 600, marginBottom: 22 }}>
                We sent a code to +91 {phone || "98765 43210"}
              </div>
              <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
                {["4", "2", "1"].map((d) => (
                  <div
                    key={d}
                    style={{
                      width: 56,
                      height: 62,
                      background: "#fff",
                      border: `2px solid ${colors.marigold}`,
                      borderRadius: 14,
                      display: "grid",
                      placeItems: "center",
                      fontFamily: "var(--font-bricolage)",
                      fontWeight: 800,
                      fontSize: 24,
                    }}
                  >
                    {d}
                  </div>
                ))}
                <div
                  style={{
                    width: 56,
                    height: 62,
                    background: "#fff",
                    border: `1.5px solid ${colors.sand}`,
                    borderRadius: 14,
                    display: "grid",
                    placeItems: "center",
                    fontFamily: "var(--font-bricolage)",
                    fontWeight: 800,
                    fontSize: 24,
                    color: "#D8C9AE",
                  }}
                >
                  <span style={{ borderLeft: `2px solid ${colors.terracotta}`, height: 26 }} />
                </div>
              </div>
              <PillButton label="Verify & start browsing →" onClick={() => router.push("/home")} />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <h2 style={{ margin: "0 0 4px", fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 26, letterSpacing: "-.6px" }}>
                  Join in 30 seconds
                </h2>
                <div style={{ fontSize: 13.5, color: colors.textMuted, fontWeight: 600 }}>Just your phone. No passwords to forget.</div>
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 7 }}>Phone number</div>
                <div style={{ display: "flex", gap: 10 }}>
                  <div
                    style={{
                      background: "#fff",
                      border: `1.5px solid ${colors.sand}`,
                      borderRadius: 12,
                      padding: "13px 14px",
                      fontWeight: 700,
                      fontSize: 14.5,
                      color: colors.textBody,
                    }}
                  >
                    🇮🇳 +91
                  </div>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="98765 43210"
                    style={{
                      flex: 1,
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
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 7 }}>What should we call you?</div>
                <input
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
                <input type="range" min={1} max={10} value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} style={{ width: "100%", cursor: "pointer" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: colors.textFaint }}>
                  <span>my street</span>
                  <span>my whole city</span>
                </div>
              </div>
              <PillButton label="Send OTP →" onClick={() => setOtpStage(true)} />
              <div style={{ textAlign: "center", fontSize: 12, color: colors.textFaint, fontWeight: 600 }}>
                By joining you agree to be a decent neighbour ✌️
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PillButton({ label, onClick }: { label: string; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "block",
        textAlign: "center",
        background: hover ? colors.terracotta : colors.ink,
        color: colors.bg,
        borderRadius: 999,
        padding: "15px 0",
        fontWeight: 800,
        fontSize: 15.5,
        cursor: "pointer",
      }}
    >
      {label}
    </div>
  );
}
