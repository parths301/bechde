"use client";

import { useState } from "react";
import { colors } from "@/lib/colors";
import { useAppState } from "@/lib/store";
import { sellCategories } from "@/lib/data";
import Stripe from "@/components/Stripe";
import Chip from "@/components/Chip";
import Button from "@/components/Button";

export default function SellPage() {
  const { sellTitle, setSellTitle, sellPrice, setSellPrice, sellCat, setSellCat, sellNote, setSellNote, name } = useAppState();
  const [sellDone, setSellDone] = useState(false);

  const noteTrim = sellNote.length > 70 ? sellNote.slice(0, 70) + "…" : sellNote;
  const sellPingWord = (sellTitle.split(" ").pop() || "item").toLowerCase();

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", width: "100%", position: "relative" }}>
      {sellDone && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(251,246,237,.94)", zIndex: 10, display: "grid", placeItems: "center" }}>
          <div style={{ textAlign: "center", animation: "bd-pop .3s ease-out", display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
            <div style={{ width: 92, height: 92, borderRadius: "50%", background: colors.pine, display: "grid", placeItems: "center", fontSize: 42, transform: "rotate(-6deg)" }}>
              🎉
            </div>
            <div style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 34, letterSpacing: "-1px" }}>Bech diya!</div>
            <div style={{ fontSize: 15, color: colors.textBody, maxWidth: 340, lineHeight: 1.6 }}>
              Your {sellPingWord} is live. We pinged <b>~40 people nearby</b> who were looking for one.
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <Button href="/product/yamaha-f310" style={{ padding: "13px 26px", fontSize: 14.5 }}>
                View listing →
              </Button>
              <Button href="/profile" variant="secondary" style={{ padding: "11px 24px", fontSize: 14.5 }}>
                My listings
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="bd-sell-grid" style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: 34, padding: "34px 36px 44px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <h1 className="bd-sell-h1" style={{ margin: 0, fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 36, letterSpacing: "-1px" }}>What are you letting go? 👋</h1>

          <div style={{ display: "flex", gap: 12 }}>
            <PhotoDropzone />
            <Stripe angle="45deg" band={8} label="photo 1" style={{ width: 120, height: 170, borderRadius: 16, fontSize: 10 }}>
              <div style={{ position: "absolute", top: 8, left: 8, background: colors.ink, color: colors.bg, fontSize: 10, fontWeight: 800, borderRadius: 6, padding: "2px 7px" }}>
                cover
              </div>
            </Stripe>
          </div>

          <div>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>Give it a name</div>
            <input
              value={sellTitle}
              onChange={(e) => setSellTitle(e.target.value)}
              style={{
                width: "100%",
                background: "#fff",
                border: `1.5px solid ${colors.sand}`,
                borderRadius: 14,
                padding: "14px 18px",
                fontSize: 15.5,
                fontWeight: 600,
                color: colors.ink,
                outline: "none",
              }}
            />
          </div>

          <div>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>Where does it belong?</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
              {sellCategories.map((c) => (
                <Chip key={c.name} icon={c.icon} name={c.name} active={sellCat === c.name} onClick={() => setSellCat(c.name)} />
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>Your price</div>
            <div className="bd-sell-price-row" style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <input
                className="bd-sell-price-input"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                style={{
                  background: "#fff",
                  border: `1.5px solid ${colors.sand}`,
                  borderRadius: 14,
                  padding: "14px 18px",
                  fontFamily: "var(--font-bricolage)",
                  fontWeight: 800,
                  fontSize: 22,
                  color: colors.clay,
                  width: 150,
                  outline: "none",
                }}
              />
              <div style={{ background: colors.sage, borderRadius: 12, padding: "10px 16px", fontSize: 13, color: colors.pine, fontWeight: 600, lineHeight: 1.45 }}>
                💡 Similar items near you sold for <b>₹2,800–3,500</b> — you&apos;re in the sweet spot.
              </div>
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>
              Tell its story <span style={{ color: colors.textFaint, fontWeight: 600 }}>(listings with a story sell 2× faster)</span>
            </div>
            <textarea
              value={sellNote}
              onChange={(e) => setSellNote(e.target.value)}
              rows={3}
              style={{
                width: "100%",
                background: "#fff",
                border: `1.5px solid ${colors.sand}`,
                borderRadius: 14,
                padding: "16px 18px",
                fontSize: 14.5,
                lineHeight: 1.6,
                color: colors.textDark,
                fontStyle: "italic",
                outline: "none",
                resize: "vertical",
              }}
            />
          </div>

          <Button onClick={() => setSellDone(true)} rotate={-1.5} style={{ alignSelf: "flex-start", padding: "15px 34px", fontSize: 16 }}>
            Bech de! →
          </Button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: colors.textFaint, textTransform: "uppercase", letterSpacing: "1px" }}>
            Live preview · how buyers see it
          </div>
          <div
            style={{
              background: "#fff",
              border: `1.5px solid ${colors.cardBorder}`,
              borderRadius: 20,
              overflow: "hidden",
              boxShadow: "0 14px 30px rgba(60,45,20,.1)",
              transform: "rotate(1.2deg)",
            }}
          >
            <Stripe angle="45deg" band={9} label="cover photo" style={{ height: 190, fontSize: 11 }}>
              <div
                style={{
                  position: "absolute",
                  top: 12,
                  left: 12,
                  background: colors.ink,
                  color: colors.bg,
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 999,
                  padding: "3px 10px",
                  whiteSpace: "nowrap",
                }}
              >
                📍 0 km · that&apos;s you!
              </div>
            </Stripe>
            <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 7 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{sellTitle}</div>
                <div style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 18, color: colors.clay, whiteSpace: "nowrap" }}>₹{sellPrice}</div>
              </div>
              <div style={{ fontSize: 12.5, fontStyle: "italic", color: colors.textMuted, lineHeight: 1.5 }}>&ldquo;{noteTrim}&rdquo;</div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: colors.textBody, fontWeight: 600 }}>
                <span style={{ width: 20, height: 20, borderRadius: "50%", background: colors.teal, flex: "none" }} />
                {name} · new seller ✨
              </div>
            </div>
          </div>
          <div style={{ background: colors.offerBg, borderRadius: 14, padding: "14px 18px", fontSize: 13, color: "#6B5320", lineHeight: 1.55, marginTop: 8 }}>
            🔔 We&apos;ll ping the <b>~40 people within 3 km</b> with saved searches for &ldquo;{sellPingWord}&rdquo;.
          </div>
        </div>
      </div>
    </div>
  );
}

function PhotoDropzone() {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 1,
        height: 170,
        border: `2.5px dashed ${hover ? colors.terracotta : "#E0B45C"}`,
        borderRadius: 20,
        background: hover ? colors.offerBg : "#FDF4DE",
        display: "grid",
        placeItems: "center",
        textAlign: "center",
        cursor: "pointer",
      }}
    >
      <div>
        <div style={{ fontSize: 26, marginBottom: 6 }}>📸</div>
        <div style={{ fontWeight: 800, fontSize: 15 }}>Drop photos here</div>
        <div style={{ fontSize: 12.5, color: colors.textFaint, fontWeight: 600 }}>up to 6 · first one becomes the cover</div>
      </div>
    </div>
  );
}
