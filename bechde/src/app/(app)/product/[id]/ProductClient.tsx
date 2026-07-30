"use client";

import { useParams, notFound, useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { colors } from "@/lib/colors";
import { useAppState } from "@/lib/store";
import {
  useItem,
  useProfile,
  startChat,
  blockProfile,
  setListingStatus,
  useCategoryAttributes,
} from "@/lib/queries";
import Stripe from "@/components/Stripe";
import Button from "@/components/Button";
import OsmMap from "@/components/OsmMap";
import ReportDialog from "@/components/ReportDialog";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { localised, localisedOption } from "@/lib/i18n/localised";

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
  const { t } = useTranslation();
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
    return <div style={{ padding: "60px 36px", textAlign: "center", color: colors.textFaint, fontWeight: 700 }}>{t("product.loading")}</div>;
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
      setChatError(e instanceof Error ? e.message : t("product.chatFailed"));
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
      setChatError(e instanceof Error ? e.message : t("product.blockFailed"));
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
      setChatError(e instanceof Error ? e.message : t("product.statusFailed"));
    } finally {
      setStatusBusy(false);
    }
  };

  const storyTitle = item.id === "yamaha-f310" ? t("product.guitarStoryTitle") : t("product.storyTitle");

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
          <Stripe angle={item.angle} src={item.cover} band={10} label={t("product.mainPhoto")} style={{ height: 420, borderRadius: 22, fontSize: 12 }}>
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
          {/* Four fixed-width thumbs don't fit a 390px phone. Let them shrink
              evenly rather than push the whole page 24px past the viewport —
              which clipped "Make an offer" and the right-hand spec cards. */}
          <div style={{ display: "flex", gap: 10, minWidth: 0 }}>
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
                  {t("product.negotiable")}
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
                {t("product.yourListing")}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {status !== "sold" && (
                  <SafetyAction label={statusBusy ? t("common.saving") : t("product.markSold")} onClick={() => changeStatus("sold")} />
                )}
                {status === "active" ? (
                  <SafetyAction label={t("product.withdrawListing")} onClick={() => changeStatus("removed")} />
                ) : (
                  <SafetyAction label={t("product.putBackUp")} onClick={() => changeStatus("active")} />
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
                  {opening ? t("product.opening") : t("product.chatWith", { name: item.seller.name.split(" ")[0] })}
                </Button>
                <Button onClick={openChat} variant="secondary" flex>
                  {t("product.makeOffer")}
                </Button>
              </div>
              <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                <SafetyAction label={t("product.reportListing")} onClick={() => setReporting(true)} />
                <SafetyAction label={t("product.blockSeller")} onClick={block} />
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

          <AttributeGrid category={item.category} attrs={item.attrs ?? {}} />

          <div style={{ background: colors.sage, borderRadius: 18, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            <OsmMap
              center={{ lat: item.lat, lng: item.lng }}
              zoom={14}
              interactive={false}
              fuzzy={!item.publicSpot}
              markers={[{ id: item.id, lat: item.lat, lng: item.lng }]}
              height={150}
              radius={14}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 22, flex: "none" }}>📍</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14.5, color: colors.pine }}>{item.pickup}</div>
                <div style={{ fontSize: 13, color: colors.pineMuted, lineHeight: 1.5 }}>
                  {item.publicSpot ? t("product.publicSpotNote") : t("product.pickupNote")}
                </div>
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
      // Share the row instead of insisting on 88px each: four of those plus gaps
      // and borders is 398px, wider than the phone they have to fit on.
      style={{ cursor: "pointer", border: `2px solid ${hover ? colors.marigold : "transparent"}`, borderRadius: 12, flex: "1 1 0", minWidth: 0, maxWidth: 88 }}
    >
      <Stripe angle={angle ?? "45deg"} src={src} band={7} label={label} style={{ width: "100%", height: 70, borderRadius: 10, fontSize: 9.5 }} />
    </div>
  );
}

function ViewProfileLink() {
  const { t } = useTranslation();
  const [hover, setHover] = useState(false);
  return (
    <Link
      href="/profile"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ fontSize: 13, fontWeight: 700, color: hover ? colors.terracottaDark : colors.clay, cursor: "pointer" }}
    >
      {t("product.viewProfile")}
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

/**
 * The attribute grid, labelled from the category's template.
 *
 * Keys are stored, labels are looked up — so renaming "Reason" to "Why are you
 * selling it?" at /admin/taxonomy relabels every listing that already answered it,
 * without touching a row. A key with no template left (an attribute since removed)
 * still renders, from its key: the seller told a buyer something, and withdrawing
 * the question isn't a reason to hide the answer.
 */
function AttributeGrid({ category, attrs }: { category: string; attrs: Record<string, string> }) {
  const { lang } = useTranslation();
  const template = useCategoryAttributes(category).data ?? [];
  const entries = Object.entries(attrs).filter(([, v]) => v);
  if (entries.length === 0) return null;

  const labelFor = (key: string) => {
    const a = template.find((t) => t.key === key);
    return a ? localised(lang, a.label, a.label_hi) : key.replace(/_/g, " ");
  };
  // The stored value is English; show its Hindi twin when there is one.
  const valueFor = (key: string, value: string) => {
    const a = template.find((t) => t.key === key);
    return a ? localisedOption(lang, a.options, a.options_hi, value) : value;
  };
  const order = (key: string) => template.find((t) => t.key === key)?.sort ?? 9999;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      {entries
        .sort((a, b) => order(a[0]) - order(b[0]))
        .map(([key, value]) => (
          <div
            key={key}
            style={{
              background: "#fff",
              border: `1.5px solid ${colors.cardBorder}`,
              borderRadius: 14,
              padding: "12px 16px",
              minWidth: 0,
            }}
          >
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: colors.textFaint,
                textTransform: "uppercase",
                letterSpacing: ".5px",
              }}
            >
              {labelFor(key)}
            </div>
            <div style={{ fontWeight: 700, fontSize: 14.5, marginTop: 3 }}>{valueFor(key, value)}</div>
          </div>
        ))}
    </div>
  );
}
