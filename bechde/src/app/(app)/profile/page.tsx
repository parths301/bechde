"use client";

import { useState } from "react";
import Link from "next/link";
import { colors } from "@/lib/colors";
import { useAppState, ProfileTab } from "@/lib/store";
import {
  useSavedListings,
  useProfileNames,
  useMyListings,
  useProfile,
  signOut,
  useBlockedIds,
  unblockProfile,
  useReviews,
  useWrittenReviews,
  updateReview,
  updateMyProfile,
} from "@/lib/queries";
import type { Item } from "@/lib/data";
import Stripe from "@/components/Stripe";
import LocationChip from "@/components/LocationChip";
import ReportDialog from "@/components/ReportDialog";

interface GridCard {
  id?: string;
  name: string;
  price: string;
  meta: string;
  tag: string;
  tagBg: string;
  tagColor: string;
  angle: string;
  cover?: string;
}

export default function ProfilePage() {
  const { profTab, setProfTab } = useAppState();
  const saved = useSavedListings().data ?? [];
  const mine = useMyListings().data ?? [];
  const myProfile = useProfile().data;
  const reviews = useReviews(myProfile?.id).data ?? [];
  const writtenReviews = useWrittenReviews(myProfile?.id).data ?? [];
  const [reviewSubtab, setReviewSubtab] = useState<"received" | "written">("received");
  const [editingReview, setEditingReview] = useState<{ id: string; rating: number; body: string } | null>(null);
  const [reportingReview, setReportingReview] = useState<{ id: string; reviewerName: string } | null>(null);
  const [isUpdatingReview, setIsUpdatingReview] = useState(false);
  const name = myProfile?.name ?? "Someone";
  const where = myProfile?.neighbourhood ?? "Koramangala, Bengaluru";
  const avatarInitial = (name || "U").trim().charAt(0).toUpperCase() || "U";

  // Real rows now: my own listings, split by status, plus whatever I've hearted.
  const active = mine.filter((i) => i.status !== "sold");
  const sold = mine.filter((i) => i.status === "sold");

  const card = (i: Item, tag: string, tagBg: string, tagColor: string, meta: string): GridCard => ({
    id: i.id,
    name: i.name,
    price: i.price,
    cover: i.cover,
    meta,
    tag,
    tagBg,
    tagColor,
    angle: i.angle,
  });

  const tabs: { key: ProfileTab; label: string }[] = [
    { key: "listings", label: `My listings · ${active.length}` },
    { key: "sold", label: `Sold · ${sold.length}` },
    { key: "saved", label: `Saved ♡ · ${saved.length}` },
    { key: "reviews", label: `Reviews · ${reviews.length}` },
  ];

  const grids: Record<ProfileTab, GridCard[]> = {
    listings: active.map((i) => card(i, "● Active", colors.sage, colors.pine, i.listedAgo || "listed")),
    sold: sold.map((i) => card(i, "✓ Sold", colors.ink, colors.bg, "sold 🎉")),
    saved: saved.map((i) => card(i, "♡ Saved", colors.savedBg, colors.savedText, `${i.dist} away`)),
    // Reviews aren't listings — rendered separately below.
    reviews: [],
  };

  // All three come from the profile row, which triggers keep in sync with the
  // reviews, sold listings and message timings behind them.
  const profStats = [
    { v: String(myProfile?.sold ?? 0), k: "sold" },
    { v: myProfile?.rating_avg ? `★ ${Number(myProfile.rating_avg).toFixed(1)}` : "—", k: myProfile?.rating_count ? `from ${myProfile.rating_count}` : "no reviews yet" },
    { v: myProfile?.reply_time ?? "—", k: "avg reply" },
  ];

  // Only badges we can actually derive. The prototype's "🤝 Reliable meeter — never
  // flaked" is gone: there's no no-show data anywhere to base it on.
  const replyMins = parseReplyMinutes(myProfile?.reply_time);
  const profBadges = [
    replyMins != null && replyMins <= 15 ? "⚡ Fast replier" : null,
    (myProfile?.sold ?? 0) > 0 ? `🌱 Gave ${myProfile!.sold} thing${myProfile!.sold === 1 ? "" : "s"} a second life` : null,
    (myProfile?.rating_count ?? 0) >= 3 && Number(myProfile?.rating_avg) >= 4.5 ? "⭐ Consistently well rated" : null,
  ].filter((b): b is string => !!b);

  const joined = myProfile?.created_at
    ? new Date(myProfile.created_at).toLocaleDateString([], { month: "short", year: "numeric" })
    : null;

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", width: "100%" }}>
      <div style={{ height: 130, background: "repeating-linear-gradient(-45deg,#F2A93B 0 18px,#EFA032 18px 36px)", position: "relative", borderRadius: "0 0 26px 26px" }}>
        <div
          className="bd-prof-avatar"
          style={{
            position: "absolute",
            left: 36,
            bottom: -44,
            width: 104,
            height: 104,
            borderRadius: 32,
            background: colors.teal,
            border: "5px solid #FBF6ED",
            display: "grid",
            placeItems: "center",
            color: "#fff",
            fontFamily: "var(--font-bricolage)",
            fontWeight: 800,
            fontSize: 38,
            transform: "rotate(-3deg)",
          }}
        >
          {avatarInitial}
        </div>
      </div>

      <div className="bd-prof-headrow" style={{ display: "flex", alignItems: "flex-end", gap: 22, padding: "14px 36px 0 164px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ margin: 0, fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 28, letterSpacing: "-.7px" }}>{name}</h1>
            {/* "phone verified" was never true — nobody verifies a phone here. Signing
                in does prove the email, so that's what the badge claims now. */}
            {myProfile?.email && (
              <span style={{ background: colors.sage, color: colors.pine, borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" }}>
                ✓ email verified
              </span>
            )}
          </div>
          <div style={{ fontSize: 13.5, color: colors.textMuted, fontWeight: 600, marginTop: 3 }}>
            {[where, joined ? `joined ${joined}` : null, myProfile?.bio ? `“${myProfile.bio}”` : null]
              .filter(Boolean)
              .join(" · ")}
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <LocationChip />
            <EditProfile name={name} bio={myProfile?.bio ?? ""} disabled={!myProfile} />
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            style={{ fontFamily: "inherit", background: "none", border: "none", padding: 0, display: "inline-block", marginTop: 8, fontSize: 12.5, fontWeight: 700, color: colors.clay, cursor: "pointer" }}
          >
            Sign out →
          </button>
        </div>
        <div className="bd-prof-stats" style={{ display: "flex", gap: 26, paddingBottom: 4 }}>
          {profStats.map((ps) => (
            <div key={ps.k} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 24, color: colors.clay, whiteSpace: "nowrap" }}>{ps.v}</div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: colors.textFaint, textTransform: "uppercase", letterSpacing: ".5px", whiteSpace: "nowrap" }}>{ps.k}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bd-prof-badges" style={{ display: "flex", gap: 10, padding: "18px 36px 0", flexWrap: "wrap" }}>
        {profBadges.map((pb) => (
          <div
            key={pb}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              background: "#fff",
              border: `1.5px solid ${colors.cardBorder}`,
              borderRadius: 999,
              padding: "7px 15px",
              fontSize: 12.5,
              fontWeight: 700,
              color: colors.textBody,
              whiteSpace: "nowrap",
              flex: "none",
            }}
          >
            {pb}
          </div>
        ))}
      </div>

      <div role="tablist" className="bd-prof-tabs" style={{ display: "flex", gap: 26, padding: "24px 36px 0", borderBottom: `1.5px dashed ${colors.divider}`, fontWeight: 800, fontSize: 14.5 }}>
        {tabs.map((t) => (
          <ProfileTabButton key={t.key} label={t.label} active={profTab === t.key} onClick={() => setProfTab(t.key)} />
        ))}
      </div>

      {profTab === "reviews" ? (
        <div style={{ padding: "24px 36px 40px", display: "flex", flexDirection: "column", gap: 12, maxWidth: 620 }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
            <button
              onClick={() => setReviewSubtab("received")}
              style={{
                fontFamily: "inherit", background: reviewSubtab === "received" ? colors.clay : "transparent",
                color: reviewSubtab === "received" ? "#fff" : colors.textFaint,
                padding: "6px 16px", borderRadius: 999, fontSize: 13, fontWeight: 800, cursor: "pointer",
                border: reviewSubtab === "received" ? "1.5px solid transparent" : `1.5px solid ${colors.cardBorder}`
              }}
            >
              Received
            </button>
            <button
              onClick={() => setReviewSubtab("written")}
              style={{
                fontFamily: "inherit", background: reviewSubtab === "written" ? colors.clay : "transparent",
                color: reviewSubtab === "written" ? "#fff" : colors.textFaint,
                padding: "6px 16px", borderRadius: 999, fontSize: 13, fontWeight: 800, cursor: "pointer",
                border: reviewSubtab === "written" ? "1.5px solid transparent" : `1.5px solid ${colors.cardBorder}`
              }}
            >
              Written
            </button>
          </div>

          {reviewSubtab === "received" ? (
            <>
              {reviews.length === 0 && (
                <div style={{ fontSize: 13.5, color: colors.textFaint, fontWeight: 600, lineHeight: 1.6 }}>
                  No reviews received yet. Once a deal is accepted in chat, the buyer can leave one.
                </div>
              )}
              {reviews.map((r) => (
                <div key={r.id} style={{ background: "#fff", border: `1.5px solid ${colors.cardBorder}`, borderRadius: 16, padding: "14px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        background: r.reviewer.color ?? colors.teal,
                        color: "#fff",
                        display: "grid",
                        placeItems: "center",
                        fontFamily: "var(--font-bricolage)",
                        fontWeight: 800,
                        fontSize: 12,
                        flex: "none",
                      }}
                    >
                      {r.reviewer.initial}
                    </span>
                    <div style={{ fontWeight: 800, fontSize: 13.5 }}>{r.reviewer.name}</div>
                    <div style={{ color: colors.marigold, fontSize: 13, letterSpacing: 1 }}>{"★".repeat(r.rating)}</div>
                    <div style={{ marginLeft: "auto", fontSize: 11.5, color: colors.textFaint, fontWeight: 600, whiteSpace: "nowrap" }}>
                      {new Date(r.createdAt).toLocaleDateString([], { month: "short", year: "numeric" })}
                    </div>
                  </div>
                  {r.body && <div style={{ fontSize: 13.5, color: colors.textBody, lineHeight: 1.6, marginTop: 8 }}>&ldquo;{r.body}&rdquo;</div>}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                    <div style={{ fontSize: 11.5, color: colors.textFaint, fontWeight: 600 }}>on {r.listingName}</div>
                    <button
                      type="button"
                      onClick={() => setReportingReview({ id: r.id, reviewerName: r.reviewer.name })}
                      style={{
                        background: "transparent",
                        border: "none",
                        padding: "4px 8px",
                        color: colors.textFaint,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        textDecoration: "underline"
                      }}
                    >
                      Report
                    </button>
                  </div>
                </div>
              ))}
              {reportingReview && (
                <ReportDialog
                  reviewId={reportingReview.id}
                  targetName={`Review by ${reportingReview.reviewerName}`}
                  onClose={() => setReportingReview(null)}
                />
              )}
            </>
          ) : (
            <>
              {writtenReviews.length === 0 && (
                <div style={{ fontSize: 13.5, color: colors.textFaint, fontWeight: 600, lineHeight: 1.6 }}>
                  You haven&apos;t written any reviews yet.
                </div>
              )}
              {writtenReviews.map((r) => (
                <div key={r.id} style={{ background: "#fff", border: `1.5px solid ${colors.cardBorder}`, borderRadius: 16, padding: "14px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        background: r.subject.color ?? colors.teal,
                        color: "#fff",
                        display: "grid",
                        placeItems: "center",
                        fontFamily: "var(--font-bricolage)",
                        fontWeight: 800,
                        fontSize: 12,
                        flex: "none",
                      }}
                    >
                      {r.subject.initial}
                    </span>
                    <div style={{ fontWeight: 800, fontSize: 13.5 }}>for {r.subject.name}</div>
                    <div style={{ color: colors.marigold, fontSize: 13, letterSpacing: 1 }}>{"★".repeat(r.rating)}</div>
                    <div style={{ marginLeft: "auto", fontSize: 11.5, color: colors.textFaint, fontWeight: 600, whiteSpace: "nowrap" }}>
                      {new Date(r.createdAt).toLocaleDateString([], { month: "short", year: "numeric" })}
                    </div>
                  </div>
                  {editingReview?.id === r.id ? (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setEditingReview({ ...editingReview, rating: star })}
                            style={{
                              background: "none",
                              border: "none",
                              fontSize: 24,
                              padding: 0,
                              cursor: "pointer",
                              color: star <= editingReview.rating ? colors.marigold : colors.cardBorder,
                            }}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={editingReview.body}
                        onChange={(e) => setEditingReview({ ...editingReview, body: e.target.value })}
                        rows={3}
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          borderRadius: 12,
                          border: `1.5px solid ${colors.cardBorder}`,
                          fontFamily: "inherit",
                          fontSize: 13.5,
                          resize: "vertical",
                        }}
                      />
                      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                        <button
                          type="button"
                          disabled={isUpdatingReview}
                          onClick={async () => {
                            setIsUpdatingReview(true);
                            try {
                              await updateReview(editingReview.id, editingReview.rating, editingReview.body);
                              setEditingReview(null);
                            } catch {
                              alert("Failed to update review.");
                            } finally {
                              setIsUpdatingReview(false);
                            }
                          }}
                          style={{
                            background: colors.clay,
                            color: "#fff",
                            border: "none",
                            padding: "6px 16px",
                            borderRadius: 999,
                            fontSize: 13,
                            fontWeight: 800,
                            cursor: "pointer",
                          }}
                        >
                          {isUpdatingReview ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          disabled={isUpdatingReview}
                          onClick={() => setEditingReview(null)}
                          style={{
                            background: "transparent",
                            color: colors.textFaint,
                            border: "none",
                            padding: "6px 16px",
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {r.body && <div style={{ fontSize: 13.5, color: colors.textBody, lineHeight: 1.6, marginTop: 8 }}>&ldquo;{r.body}&rdquo;</div>}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                        <div style={{ fontSize: 11.5, color: colors.textFaint, fontWeight: 600 }}>on {r.listingName}</div>
                        <button
                          type="button"
                          onClick={() => setEditingReview({ id: r.id, rating: r.rating, body: r.body ?? "" })}
                          style={{
                            background: "transparent",
                            border: "none",
                            padding: "4px 8px",
                            color: colors.textFaint,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                            textDecoration: "underline"
                          }}
                        >
                          Edit
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      ) : (
        <div className="bd-prof-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18, padding: "24px 36px 40px" }}>
          {grids[profTab].map((pl, i) => (
            <ProfileGridCard key={`${pl.name}-${i}`} card={pl} />
          ))}
        </div>
      )}

      <BlockedList />

      <div style={{ padding: "8px 36px 44px", display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12.5, fontWeight: 700, color: colors.textFaint }}>
        <Link href="/legal/terms" style={{ color: colors.textFaint }}>
          Terms
        </Link>
        <Link href="/legal/privacy" style={{ color: colors.textFaint }}>
          Privacy
        </Link>
        <Link href="/legal/prohibited" style={{ color: colors.textFaint }}>
          What&apos;s not allowed
        </Link>
      </div>
    </div>
  );
}

/** "22 min" / "under a min" / "2 hr" → minutes, for the fast-replier badge. */
function parseReplyMinutes(reply: string | null | undefined): number | null {
  if (!reply) return null;
  if (/under a min/.test(reply)) return 0;
  const n = Number(reply.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n)) return null;
  if (/hr/.test(reply)) return n * 60;
  if (/day/.test(reply)) return n * 60 * 24;
  return n;
}

/** Inline editor for the two fields a person actually sets themselves. */
function EditProfile({ name, bio, disabled }: { name: string; bio: string; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftBio, setDraftBio] = useState(bio);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateMyProfile({ name: draftName, bio: draftBio });
      setOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          if (disabled) return;
          setDraftName(name);
          setDraftBio(bio);
          setOpen(true);
        }}
        style={{
          fontFamily: "inherit",
          background: "#fff",
          border: `1.5px solid ${colors.sand}`,
          borderRadius: 999,
          padding: "7px 14px",
          fontSize: 12.5,
          fontWeight: 700,
          color: colors.textBody,
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.5 : 1,
          whiteSpace: "nowrap",
        }}
      >
        ✎ Edit profile
      </button>
    );
  }

  const field = {
    background: "#fff",
    border: `1.5px solid ${colors.sand}`,
    borderRadius: 12,
    padding: "9px 13px",
    fontSize: 13.5,
    color: colors.ink,
    outline: "none",
    fontFamily: "inherit" as const,
  };

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="Your name" style={{ ...field, width: 150 }} />
      <input
        value={draftBio}
        onChange={(e) => setDraftBio(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
        }}
        placeholder="One line about you"
        style={{ ...field, width: 240 }}
      />
      <button type="button" onClick={save} style={{ fontFamily: "inherit", border: "none", background: colors.ink, color: colors.bg, borderRadius: 999, padding: "8px 16px", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>
        {busy ? "Saving…" : "Save"}
      </button>
      <button type="button" onClick={() => setOpen(false)} style={{ fontFamily: "inherit", background: "none", border: "none", padding: 0, fontSize: 12.5, fontWeight: 700, color: colors.textFaint, cursor: "pointer" }}>
        Cancel
      </button>
      {error && <div style={{ fontSize: 12, fontWeight: 700, color: colors.terracotta }}>{error}</div>}
    </div>
  );
}

/** People you've blocked, with a way back. Empty for almost everyone, so it hides itself. */
function BlockedList() {
  const blocked = useBlockedIds();
  const [busy, setBusy] = useState<string | null>(null);
  const [gone, setGone] = useState<string[]>([]);
  const ids = (blocked.data ?? []).filter((id) => !gone.includes(id));
  const names = useProfileNames(ids).data ?? {};
  
  if (!ids.length) return null;

  const nameOf = (id: string) => names[id] ?? "Someone you blocked";

  const undo = async (id: string) => {
    setBusy(id);
    try {
      await unblockProfile(id);
      setGone((g) => [...g, id]);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ padding: "0 36px 24px" }}>
      <div style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 16, marginBottom: 10 }}>Blocked people</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 460 }}>
        {ids.map((id) => (
          <div
            key={id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "#fff",
              border: `1.5px solid ${colors.cardBorder}`,
              borderRadius: 12,
              padding: "10px 14px",
            }}
          >
            <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: colors.ink }}>{nameOf(id)}</div>
            <button
              type="button"
              onClick={() => undo(id)}
              style={{ fontFamily: "inherit", background: "none", border: "none", padding: 0, fontSize: 12.5, fontWeight: 800, color: colors.clay, cursor: "pointer", whiteSpace: "nowrap" }}
            >
              {busy === id ? "…" : "Unblock"}
            </button>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: colors.textFaint, fontWeight: 600, marginTop: 8 }}>
        Their listings stay hidden from you and they can&apos;t message you until you unblock them.
      </div>
    </div>
  );
}

function ProfileTabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        fontFamily: "inherit",
        background: "none",
        padding: "0 0 12px",
        border: "none",
        borderBottom: `3px solid ${active ? colors.terracotta : "transparent"}`,
        color: active || hover ? colors.ink : colors.textFaint,
        cursor: "pointer",
        whiteSpace: "nowrap",
        flex: "none",
        fontSize: "inherit",
        fontWeight: "inherit",
      }}
    >
      {label}
    </button>
  );
}

function ProfileGridCard({ card }: { card: GridCard }) {
  const [hover, setHover] = useState(false);
  const inner = (
    <>
      <Stripe angle={card.angle} src={card.cover} band={8} label="product photo" style={{ height: 130, fontSize: 10 }}>
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            background: card.tagBg,
            color: card.tagColor,
            fontSize: 11,
            fontWeight: 800,
            borderRadius: 999,
            padding: "3px 10px",
            whiteSpace: "nowrap",
          }}
        >
          {card.tag}
        </div>
      </Stripe>
      <div style={{ padding: "13px 15px", display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: colors.ink }}>{card.name}</div>
          <div style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 15, color: colors.clay, whiteSpace: "nowrap" }}>{card.price}</div>
        </div>
        <div style={{ fontSize: 12, color: colors.textFaint, fontWeight: 600 }}>{card.meta}</div>
      </div>
    </>
  );
  const style = {
    background: "#fff",
    border: `1.5px solid ${colors.cardBorder}`,
    borderRadius: 18,
    overflow: "hidden",
    cursor: card.id ? ("pointer" as const) : ("default" as const),
    display: "block" as const,
    ...(hover && card.id ? { transform: "translateY(-4px)", boxShadow: "0 10px 24px rgba(60,45,20,.1)" } : null),
  };

  if (card.id) {
    return (
      <Link href={`/product/${card.id}`} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={style}>
        {inner}
      </Link>
    );
  }
  return <div style={style}>{inner}</div>;
}
