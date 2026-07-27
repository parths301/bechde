"use client";

import { useParams, notFound, useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { colors } from "@/lib/colors";
import { useAppState } from "@/lib/store";
import { useItem, useProfile, startChat, blockProfile, setListingStatus } from "@/lib/queries";
import Stripe from "@/components/Stripe";
import Button from "@/components/Button";
import OsmMap from "@/components/OsmMap";
import ReportDialog from "@/components/ReportDialog";

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
  const router = useRouter();
  const { data: item, loading } = useItem(params.id);
  const { isLiked, toggleLike } = useAppState();
  const me = useProfile().data;
  const [chatError, setChatError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [localStatus, setLocalStatus] = useState<string | null>(null);

  if (loading) {
    return <div style={{ padding: "60px 36px", textAlign: "center", color: colors.textFaint, fontWeight: 700 }}>Loading…</div>;
  }
  if (!item) notFound();

  const liked = isLiked(item.id);
  const isMine = !!me && me.id === item.seller.id;

  // Open (or reuse) this buyer's thread for the listing, then jump into it.
  const openChat = async () => {
    if (opening || !item.seller.id) return;
    setOpening(true);
    setChatError(null);
    try {
      const chatId = await startChat(item.id, item.seller.id);
      router.push(`/chat?c=${encodeURIComponent(chatId)}`);
    } catch (e: unknown) {
      setChatError(e instanceof Error ? e.message : "Couldn't open the chat.");
      setOpening(false);
    }
  };

  const block = async () => {
    if (!item.seller.id) return;
    setChatError(null);
    try {
      await blockProfile(item.seller.id);
      setBlocked(true);
    } catch (e: unknown) {
      setChatError(e instanceof Error ? e.message : "Couldn't block that seller.");
    }
  };

  // Sellers withdraw or mark sold; the row stays so the thread history survives.
  const status = localStatus ?? item.status ?? "active";
  const changeStatus = async (next: "active" | "sold" | "removed") => {
    if (statusBusy) return;
    setStatusBusy(true);
    setChatError(null);
    try {
      await setListingStatus(item.id, next);
      setLocalStatus(next);
    } catch (e: unknown) {
      setChatError(e instanceof Error ? e.message : "Couldn't update the listing.");
    } finally {
      setStatusBusy(false);
    }
  };

  const storyTitle = item.id === "yamaha-f310" ? "This guitar's story 📖" : "This one's story 📖";

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", width: "100%" }}>
      <div className="bd-product-crumb" style={{ padding: "16px 36px 8px", fontSize: 13, color: colors.textFaint, fontWeight: 600 }}>
        <Link href="/home" style={{ cursor: "pointer", color: colors.clay, textDecoration: "underline" }}>
          ← Browse
        </Link>{" "}
        → {categoryIcons[item.category]} {item.category} → <span style={{ color: colors.ink }}>{item.name}</span>
      </div>

      <div className="bd-product-grid" style={{ display: "grid", gridTemplateColumns: "560px 1fr", gap: 34, padding: "14px 36px 40px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Stripe angle={item.angle} src={item.cover} band={10} label="main product photo" style={{ height: 420, borderRadius: 22, fontSize: 12 }}>
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
          {/* Real uploads when there are any; the striped placeholders only fill the
              remaining slots so the row keeps its shape. */}
          <div style={{ display: "flex", gap: 10 }}>
            {(item.images ?? []).slice(0, 4).map((url) => (
              <Thumb key={url} src={url} />
            ))}
            {thumbLabels.slice((item.images ?? []).length, 4).map((t) => (
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
            <h1 className="bd-product-h1" style={{ margin: "0 0 6px", fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 32, lineHeight: 1.15, letterSpacing: "-.8px" }}>
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
                {item.seller.name} <span style={{ color: colors.offerText }}>{item.seller.rating}</span>
              </div>
              <div style={{ fontSize: 12.5, color: colors.textFaint, fontWeight: 600 }}>
                {item.seller.sold} items sold · usually replies in {item.seller.replyTime}
              </div>
            </div>
            <ViewProfileLink />
          </div>

          {status !== "active" && (
            <div style={{ background: colors.ink, color: colors.bg, borderRadius: 14, padding: "12px 18px", fontSize: 13.5, fontWeight: 800 }}>
              {status === "sold" ? "✓ This one's sold" : "This listing has been withdrawn"}
            </div>
          )}

          {isMine ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ background: colors.sage, color: colors.pine, borderRadius: 14, padding: "14px 18px", fontSize: 13.5, fontWeight: 700 }}>
                This is your listing — buyers&apos; chats show up under 💬 Chats.
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {status !== "sold" && (
                  <SafetyAction label={statusBusy ? "Saving…" : "✓ Mark as sold"} onClick={() => changeStatus("sold")} />
                )}
                {status === "active" ? (
                  <SafetyAction label="Withdraw listing" onClick={() => changeStatus("removed")} />
                ) : (
                  <SafetyAction label="Put it back up" onClick={() => changeStatus("active")} />
                )}
              </div>
            </div>
          ) : blocked ? (
            <div style={{ background: colors.bg2, color: colors.textBody, borderRadius: 14, padding: "14px 18px", fontSize: 13.5, fontWeight: 700 }}>
              You blocked {item.seller.name.split(" ")[0]}. Their listings and your shared chats are hidden — undo it from
              your profile.
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 12 }}>
                <Button onClick={openChat} variant="primary" flex>
                  {opening ? "Opening…" : `💬 Chat with ${item.seller.name.split(" ")[0]}`}
                </Button>
                <Button onClick={openChat} variant="secondary" flex>
                  Make an offer
                </Button>
              </div>
              <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                <SafetyAction label="⚑ Report listing" onClick={() => setReporting(true)} />
                <SafetyAction label="Block seller" onClick={block} />
              </div>
            </>
          )}
          {chatError && <div style={{ fontSize: 13, fontWeight: 700, color: colors.terracotta }}>{chatError}</div>}

          {reporting && (
            <ReportDialog
              listingId={item.id}
              sellerId={item.seller.id}
              targetName={item.name}
              onClose={() => setReporting(false)}
            />
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {item.facts.map((fa) => (
              <div key={fa.k} style={{ background: "#fff", border: `1.5px solid ${colors.cardBorder}`, borderRadius: 14, padding: "12px 16px" }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: colors.textFaint, textTransform: "uppercase", letterSpacing: ".5px" }}>{fa.k}</div>
                <div style={{ fontWeight: 700, fontSize: 14.5, marginTop: 3 }}>{fa.v}</div>
              </div>
            ))}
          </div>

          <div style={{ background: colors.sage, borderRadius: 18, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            <OsmMap
              center={{ lat: item.lat, lng: item.lng }}
              zoom={14}
              interactive={false}
              fuzzy
              markers={[{ id: item.id, lat: item.lat, lng: item.lng }]}
              height={150}
              radius={14}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 22, flex: "none" }}>📍</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14.5, color: colors.pine }}>{item.pickup}</div>
                <div style={{ fontSize: 13, color: colors.pineMuted, lineHeight: 1.5 }}>Exact spot shared after you chat. Public meetup points suggested.</div>
              </div>
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
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        fontFamily: "inherit",
        padding: 0,
        border: "none",
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
    </button>
  );
}

function Thumb({ src, label, angle }: { src?: string; label?: string; angle?: string }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ cursor: "pointer", border: `2px solid ${hover ? colors.marigold : "transparent"}`, borderRadius: 12 }}
    >
      <Stripe angle={angle ?? "45deg"} src={src} band={7} label={label} style={{ width: 88, height: 70, borderRadius: 10, fontSize: 9.5 }} />
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

/** Quiet secondary action — report, block, mark sold, withdraw. */
function SafetyAction({ label, onClick }: { label: string; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        fontFamily: "inherit",
        background: "#fff",
        border: `1.5px solid ${hover ? colors.terracotta : colors.sand}`,
        color: hover ? colors.clay : colors.textBody,
        borderRadius: 999,
        padding: "8px 16px",
        fontSize: 12.5,
        fontWeight: 700,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}
