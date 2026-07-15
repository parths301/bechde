"use client";

import { useState } from "react";
import Link from "next/link";
import { colors } from "@/lib/colors";
import { useAppState } from "@/lib/store";
import { chatThreads } from "@/lib/data";
import Stripe from "@/components/Stripe";

const quickReplyTexts = ["Is it available?", "Last price?", "Can I see it today?"];

export default function ChatPage() {
  const { offerAccepted, acceptOffer, draft, setDraft, sentMsgs, sendMsg } = useAppState();

  const handleSend = () => {
    if (draft.trim()) {
      sendMsg(draft.trim());
      setDraft("");
    }
  };

  return (
    <div className="bd-chat-grid" style={{ flex: 1, display: "grid", gridTemplateColumns: "340px 1fr", minHeight: "calc(100vh - 76px)" }}>
      <div className="bd-chat-list" style={{ borderRight: `1.5px dashed ${colors.divider}`, padding: "22px 0", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "0 22px 16px", fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 22, letterSpacing: "-.5px" }}>Chats</div>
        {chatThreads.map((cl) => (
          <ChatListRow key={cl.id} thread={cl} offerAccepted={offerAccepted} />
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div className="bd-chat-head" style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 26px", borderBottom: `1.5px dashed ${colors.divider}`, background: "#fff" }}>
          <Link href="/product/yamaha-f310" style={{ display: "block", flex: "none" }}>
            <Stripe angle="60deg" band={6} style={{ width: 52, height: 52, borderRadius: 14, cursor: "pointer" }} />
          </Link>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Yamaha F310 acoustic guitar</div>
            <div style={{ fontSize: 12.5, color: colors.textFaint, fontWeight: 600 }}>with Rohan T. · ★ 4.9 · 1.1 km away</div>
          </div>
          <div style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 20, color: colors.clay }}>₹3,200</div>
        </div>

        <div className="bd-chat-body" style={{ flex: 1, padding: "24px 26px", display: "flex", flexDirection: "column", gap: 14, background: "radial-gradient(circle at 80% 10%,#F6EEDD 0%,#FBF6ED 55%)" }}>
          <div style={{ alignSelf: "center", background: "#EFE7DA", color: colors.textMuted, fontSize: 11.5, fontWeight: 700, borderRadius: 999, padding: "4px 14px" }}>
            Today, 4:12 PM
          </div>
          <div style={{ alignSelf: "flex-end", maxWidth: 420, background: colors.ink, color: colors.bg, borderRadius: "18px 4px 18px 18px", padding: "12px 16px", fontSize: 14.5, lineHeight: 1.55 }}>
            Hi! Is the guitar still available? Are the strings original?
          </div>
          <div
            style={{
              alignSelf: "flex-start",
              maxWidth: 420,
              background: "#fff",
              border: `1.5px solid ${colors.cardBorder}`,
              borderRadius: "4px 18px 18px 18px",
              padding: "12px 16px",
              fontSize: 14.5,
              lineHeight: 1.55,
            }}
          >
            Yes, available! Changed the strings 3 months ago — D&apos;Addario. Sounds warm 🙂
          </div>

          {!offerAccepted && (
            <div
              style={{
                alignSelf: "flex-end",
                background: colors.offerBg,
                border: `1.5px dashed ${colors.offerBorder}`,
                borderRadius: 16,
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: colors.offerText, textTransform: "uppercase", letterSpacing: ".5px" }}>Your offer</div>
                <div style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 22, color: colors.clay }}>₹2,900</div>
              </div>
              <div style={{ fontSize: 12.5, color: colors.offerText, fontWeight: 700 }}>waiting for Rohan…</div>
              <SimulateAcceptButton onClick={acceptOffer} />
            </div>
          )}

          {offerAccepted && (
            <>
              <div
                style={{
                  alignSelf: "center",
                  background: colors.sage,
                  border: `1.5px solid ${colors.sageBorder}`,
                  borderRadius: 16,
                  padding: "16px 24px",
                  textAlign: "center",
                  animation: "bd-pop .3s ease-out",
                }}
              >
                <div style={{ fontSize: 22, marginBottom: 4 }}>🤝</div>
                <div style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 18, color: colors.pine }}>Deal at ₹2,900!</div>
                <div style={{ fontSize: 12.5, color: colors.pineMuted, fontWeight: 600 }}>Rohan accepted your offer</div>
              </div>
              <div style={{ alignSelf: "flex-start", background: colors.sage, borderRadius: 16, padding: "14px 18px", maxWidth: 400, animation: "bd-pop .35s ease-out" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: colors.pine, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>📍 Meet-up suggestion</div>
                <div style={{ fontWeight: 800, fontSize: 14.5, color: colors.pineDark }}>Third Wave Coffee, 5th Block</div>
                <div style={{ fontSize: 12.5, color: colors.pineMuted, margin: "2px 0 10px" }}>Tomorrow · 6:00 PM · public spot, well lit</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <MeetupChip label="Works for me ✓" primary />
                  <MeetupChip label="Suggest another" />
                </div>
              </div>
            </>
          )}

          {sentMsgs.map((sm, i) => (
            <div
              key={i}
              style={{
                alignSelf: "flex-end",
                maxWidth: 420,
                background: colors.ink,
                color: colors.bg,
                borderRadius: "18px 4px 18px 18px",
                padding: "12px 16px",
                fontSize: 14.5,
                lineHeight: 1.55,
                animation: "bd-pop .25s ease-out",
              }}
            >
              {sm}
            </div>
          ))}
        </div>

        <div className="bd-chat-input" style={{ padding: "16px 26px", borderTop: `1.5px dashed ${colors.divider}`, background: colors.bg }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {quickReplyTexts.map((t) => (
              <QuickReplyChip key={t} text={t} onSend={() => sendMsg(t)} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
              placeholder="Type a message…"
              style={{
                flex: 1,
                background: "#fff",
                border: `1.5px solid ${colors.sand}`,
                borderRadius: 999,
                padding: "13px 20px",
                fontSize: 14.5,
                color: colors.ink,
                outline: "none",
              }}
            />
            <SendButton onClick={handleSend} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatListRow({ thread, offerAccepted }: { thread: (typeof chatThreads)[number]; offerAccepted: boolean }) {
  const [hover, setHover] = useState(false);
  const last = thread.id === "yamaha-f310" ? (offerAccepted ? "Deal at ₹2,900 🤝" : "Offer made: ₹2,900") : thread.last;
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ display: "flex", gap: 12, padding: "13px 22px", cursor: "pointer", background: hover || thread.active ? "#F6EEDD" : "transparent" }}
    >
      <div style={{ position: "relative", flex: "none" }}>
        <Stripe angle={thread.angle} band={6} style={{ width: 46, height: 46, borderRadius: 14 }} />
        <div
          style={{
            position: "absolute",
            right: -5,
            bottom: -5,
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: thread.avatar,
            border: "2px solid #FBF6ED",
            display: "grid",
            placeItems: "center",
            color: "#fff",
            fontFamily: "var(--font-bricolage)",
            fontWeight: 800,
            fontSize: 10,
          }}
        >
          {thread.initial}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontWeight: 800, fontSize: 13.5 }}>{thread.item}</span>
          <span style={{ fontSize: 11, color: colors.textFaint, fontWeight: 700, whiteSpace: "nowrap" }}>{thread.time}</span>
        </div>
        <div style={{ fontSize: 12.5, color: colors.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{last}</div>
      </div>
    </div>
  );
}

function SimulateAcceptButton({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? colors.teal : colors.pine,
        color: "#fff",
        borderRadius: 999,
        padding: "8px 18px",
        fontSize: 13,
        fontWeight: 800,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      simulate: Rohan accepts ✓
    </div>
  );
}

function MeetupChip({ label, primary }: { label: string; primary?: boolean }) {
  return (
    <div
      style={{
        background: primary ? colors.pine : "#fff",
        color: primary ? "#fff" : colors.pine,
        borderRadius: 999,
        padding: "7px 16px",
        fontSize: 12.5,
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      {label}
    </div>
  );
}

function QuickReplyChip({ text, onSend }: { text: string; onSend: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onSend}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "#fff",
        border: `1.5px solid ${hover ? colors.marigold : colors.sand}`,
        borderRadius: 999,
        padding: "7px 14px",
        fontSize: 12.5,
        fontWeight: 700,
        color: hover ? colors.clay : colors.textBody,
        cursor: "pointer",
        whiteSpace: "nowrap",
        flex: "none",
      }}
    >
      {text}
    </div>
  );
}

function SendButton({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 46,
        height: 46,
        borderRadius: "50%",
        background: colors.terracotta,
        display: "grid",
        placeItems: "center",
        color: "#fff",
        fontSize: 17,
        cursor: "pointer",
        flex: "none",
        transform: hover ? "scale(1.08) rotate(-8deg)" : undefined,
      }}
    >
      ➤
    </div>
  );
}
