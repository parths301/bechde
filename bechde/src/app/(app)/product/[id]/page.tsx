"use client";

import { useParams, notFound } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { colors } from "@/lib/colors";
import { useAppState } from "@/lib/store";
import { getItem } from "@/lib/data";
import Stripe from "@/components/Stripe";
import Button from "@/components/Button";

const categoryIcons: Record<string, string> = {
  Gadgets: "📱",
  Furniture: "🛋️",
  Music: "🎸",
  Fashion: "👕",
  Books: "📚",
  Everything: "🧺",
};

const thumbLabels = [
  { label: "front", angle: "45deg" },
  { label: "back", angle: "60deg" },
  { label: "close-up", angle: "30deg" },
  { label: "in context", angle: "75deg" },
];

export default function ProductPage() {
  const params = useParams<{ id: string }>();
  const item = getItem(params.id);
  const { isLiked, toggleLike } = useAppState();

  if (!item) notFound();

  const liked = isLiked(item.id);
  const storyTitle = item.id === "yamaha-f310" ? "This guitar's story 📖" : "This one's story 📖";

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", width: "100%" }}>
      <div style={{ padding: "16px 36px 8px", fontSize: 13, color: colors.textFaint, fontWeight: 600 }}>
        <Link href="/home" style={{ cursor: "pointer", color: colors.clay }}>
          ← Browse
        </Link>{" "}
        → {categoryIcons[item.category]} {item.category} → <span style={{ color: colors.ink }}>{item.name}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "560px 1fr", gap: 34, padding: "14px 36px 40px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Stripe angle={item.angle} band={10} label="main product photo" style={{ height: 420, borderRadius: 22, fontSize: 12 }}>
            <div
              style={{
                position: "absolute",
                top: 14,
                left: 14,
                background: colors.ink,
                color: colors.bg,
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 999,
                padding: "4px 12px",
                whiteSpace: "nowrap",
              }}
            >
              📍 {item.dist} · {item.neighbourhood.split(",")[0]}
            </div>
            <LikeButton liked={liked} onClick={() => toggleLike(item.id)} />
          </Stripe>
          <div style={{ display: "flex", gap: 10 }}>
            {thumbLabels.map((t) => (
              <Thumb key={t.label} label={t.label} angle={t.angle} />
            ))}
          </div>
          <div style={{ marginTop: 10, background: "#fff", border: `1.5px solid ${colors.cardBorder}`, borderRadius: 18, padding: "20px 22px" }}>
            <div style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 17, marginBottom: 14 }}>{storyTitle}</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {item.story.map((tl, i) => (
                <div key={i} style={{ display: "flex", gap: 14 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ width: 12, height: 12, borderRadius: "50%", background: tl.dot, flex: "none", marginTop: 4 }} />
                    {i < item.story.length - 1 && <div style={{ width: 2, flex: 1, background: colors.cardBorder }} />}
                  </div>
                  <div style={{ paddingBottom: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                      {tl.title} <span style={{ color: colors.textFaint, fontWeight: 600, fontSize: 12 }}>· {tl.when}</span>
                    </div>
                    <div style={{ fontSize: 13, color: colors.textBody, lineHeight: 1.5 }}>{tl.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <h1 style={{ margin: "0 0 6px", fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 32, lineHeight: 1.15, letterSpacing: "-.8px" }}>
              {item.name}
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 34, color: colors.clay }}>{item.price}</div>
              {item.negotiable && (
                <div style={{ background: colors.sage, color: colors.pine, borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
                  negotiable
                </div>
              )}
              <div style={{ fontSize: 13, color: colors.textFaint, fontWeight: 600 }}>{item.listedAgo}</div>
            </div>
          </div>

          <div style={{ background: colors.offerBg, borderRadius: "4px 18px 18px 18px", padding: "16px 20px", fontSize: 14.5, lineHeight: 1.65, color: "#6B5320", fontStyle: "italic" }}>
            &ldquo;{item.note}&rdquo;
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#fff", border: `1.5px solid ${colors.cardBorder}`, borderRadius: 16, padding: "14px 18px" }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: item.seller.color,
                display: "grid",
                placeItems: "center",
                color: "#fff",
                fontFamily: "var(--font-bricolage)",
                fontWeight: 800,
                fontSize: 18,
              }}
            >
              {item.seller.initial}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>
                {item.seller.name} <span style={{ color: colors.marigold }}>{item.seller.rating}</span>
              </div>
              <div style={{ fontSize: 12.5, color: colors.textFaint, fontWeight: 600 }}>
                {item.seller.sold} items sold · usually replies in {item.seller.replyTime}
              </div>
            </div>
            <ViewProfileLink />
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <Button href="/chat" variant="primary" flex>
              💬 Chat with {item.seller.name.split(" ")[0]}
            </Button>
            <Button href="/chat" variant="secondary" flex>
              Make an offer
            </Button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {item.facts.map((fa) => (
              <div key={fa.k} style={{ background: "#fff", border: `1.5px solid ${colors.cardBorder}`, borderRadius: 14, padding: "12px 16px" }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: colors.textFaint, textTransform: "uppercase", letterSpacing: ".5px" }}>{fa.k}</div>
                <div style={{ fontWeight: 700, fontSize: 14.5, marginTop: 3 }}>{fa.v}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 18, background: colors.sage, borderRadius: 18, padding: "16px 20px" }}>
            <div style={{ position: "relative", width: 84, height: 84, flex: "none" }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1.5px dashed #9DBFB2" }} />
              <div style={{ position: "absolute", inset: 22, borderRadius: "50%", border: "1.5px dashed #9DBFB2" }} />
              <div style={{ position: "absolute", left: "50%", top: "50%", width: 10, height: 10, transform: "translate(-50%,-50%)", borderRadius: "50%", background: colors.terracotta }} />
              <div
                style={{
                  position: "absolute",
                  left: 14,
                  top: 16,
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  border: "2px solid #fff",
                  background: "repeating-linear-gradient(45deg,#DCE9E2 0 4px,#C7DBD1 4px 8px)",
                }}
              />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14.5, color: colors.pine }}>{item.pickup}</div>
              <div style={{ fontSize: 13, color: colors.pineMuted, lineHeight: 1.5 }}>Exact spot shared after you chat. Public meetup points suggested.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LikeButton({ liked, onClick }: { liked: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "absolute",
        top: 14,
        right: 14,
        width: 42,
        height: 42,
        borderRadius: "50%",
        background: "#fff",
        display: "grid",
        placeItems: "center",
        fontSize: 18,
        cursor: "pointer",
        boxShadow: "0 3px 8px rgba(60,45,20,.15)",
        color: liked ? colors.terracotta : colors.ink,
        transform: hover ? "scale(1.12)" : undefined,
      }}
    >
      {liked ? "♥" : "♡"}
    </div>
  );
}

function Thumb({ label, angle }: { label: string; angle: string }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ cursor: "pointer", border: `2px solid ${hover ? colors.marigold : "transparent"}`, borderRadius: 12 }}
    >
      <Stripe angle={angle} band={7} label={label} style={{ width: 88, height: 70, borderRadius: 10, fontSize: 9.5 }} />
    </div>
  );
}

function ViewProfileLink() {
  const [hover, setHover] = useState(false);
  return (
    <Link
      href="/profile"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ fontSize: 13, fontWeight: 700, color: hover ? colors.terracottaDark : colors.clay, cursor: "pointer" }}
    >
      view profile →
    </Link>
  );
}
