"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { colors } from "@/lib/colors";
import { useAppState } from "@/lib/store";
import {
  useChatThreads,
  useItems,
  useProfile,
  useConversation,
  sendMessage,
  makeOffer,
  setOfferStatus,
  markChatRead,
  useMyReviewFor,
  submitReview,
  type Thread,
  type ChatMessage,
  type ChatOffer,
} from "@/lib/queries";
import Stripe from "@/components/Stripe";

const quickReplyTexts = ["Is it available?", "Last price?", "Can I see it today?"];

type Entry = { at: string; msg: ChatMessage } | { at: string; offer: ChatOffer };

export default function ChatPage() {
  return (
    <Suspense fallback={<ChatFallback>Loading chats…</ChatFallback>}>
      <ChatScreen />
    </Suspense>
  );
}

function ChatFallback({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, display: "grid", placeItems: "center", minHeight: "calc(100vh - 76px)", color: colors.textFaint, fontWeight: 700 }}>
      {children}
    </div>
  );
}

function ChatScreen() {
  const { draft, setDraft } = useAppState();
  const me = useProfile().data;
  const chatThreads = useChatThreads().data ?? [];
  const items = useItems().data ?? [];
  const byId = new Map(items.map((i) => [i.id, i]));
  // On mobile this drives the master-detail view: null = show the list,
  // a thread id = show that conversation. Desktop shows both panes regardless.
  // Arriving from a listing's "Chat with …" button: /chat?c=<chatId>.
  const fromUrl = useSearchParams().get("c");
  // undefined = nothing picked yet (fall back to the URL), null = closed on mobile.
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const openId = picked === undefined ? fromUrl : picked;
  const setOpenId = setPicked;
  const [offerDraft, setOfferDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const activeThread = chatThreads.find((t) => t.id === openId) ?? chatThreads[0];
  const activeItem = activeThread ? byId.get(activeThread.itemId) : undefined;
  const convo = useConversation(activeThread?.id ?? null);
  const latestOffer = convo.offers.at(-1);
  const dealOffer = latestOffer?.status === "accepted" ? latestOffer : null;
  const myReview = useMyReviewFor(dealOffer?.id ?? null);

  // Opening a thread clears its unread badge.
  const activeId = activeThread?.id;
  useEffect(() => {
    if (activeId) markChatRead(activeId);
  }, [activeId]);

  if (!activeThread || !activeItem) {
    return (
      <div style={{ flex: 1, display: "grid", placeItems: "center", minHeight: "calc(100vh - 76px)", color: colors.textFaint, fontWeight: 700 }}>
        {me ? "No chats yet — say hello on a listing you like 👋" : "Loading chats…"}
      </div>
    );
  }

  const send = async (text: string) => {
    const body = text.trim();
    if (!body) return;
    setError(null);
    try {
      convo.push(await sendMessage(activeThread.id, body));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Message didn't send.");
    }
  };

  const handleSend = () => {
    if (!draft.trim()) return;
    const body = draft;
    setDraft("");
    send(body);
  };

  const submitOffer = async () => {
    const raw = offerDraft.replace(/[^\d]/g, "");
    if (!raw) return;
    setOfferDraft("");
    setError(null);
    try {
      convo.push(await makeOffer(activeThread.id, activeThread.itemId, `₹${Number(raw).toLocaleString("en-IN")}`));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Offer didn't go through.");
    }
  };

  const respond = async (offer: ChatOffer, status: "accepted" | "declined") => {
    setError(null);
    try {
      convo.push(await setOfferStatus(offer.id, status));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Couldn't update the offer.");
    }
  };

  // Messages and offers share one timeline, ordered by when they happened.
  const timeline: Entry[] = [
    ...convo.messages.map((msg) => ({ at: msg.createdAt, msg })),
    ...convo.offers.map((offer) => ({ at: offer.createdAt, offer })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className={`bd-chat-grid${openId ? " bd-chat-open" : ""}`} style={{ flex: 1, display: "grid", gridTemplateColumns: "340px 1fr", minHeight: "calc(100vh - 76px)" }}>
      <div className="bd-chat-list" style={{ borderRight: `1.5px dashed ${colors.divider}`, padding: "22px 0", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "0 22px 16px", fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 22, letterSpacing: "-.5px" }}>Chats</div>
        {chatThreads.map((cl) => (
          <ChatListRow key={cl.id} thread={cl} cover={byId.get(cl.itemId)?.cover} active={activeThread.id === cl.id} onOpen={() => setOpenId(cl.id)} />
        ))}
      </div>

      <div className="bd-chat-convo" style={{ display: "flex", flexDirection: "column" }}>
        <div className="bd-chat-head" style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 26px", borderBottom: `1.5px dashed ${colors.divider}`, background: "#fff" }}>
          <div
            className="bd-chat-back"
            onClick={() => setOpenId(null)}
            role="button"
            aria-label="Back to chats"
            style={{ flex: "none", width: 36, height: 36, borderRadius: "50%", placeItems: "center", background: colors.bg2, color: colors.ink, fontSize: 18, cursor: "pointer" }}
          >
            ←
          </div>
          <Link href={`/product/${activeThread.itemId}`} aria-label={`View listing: ${activeItem.name}`} style={{ display: "block", flex: "none" }}>
            <Stripe angle={activeThread.angle} src={activeItem.cover} band={6} style={{ width: 52, height: 52, borderRadius: 14, cursor: "pointer" }} />
          </Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{activeItem.name}</div>
            <div style={{ fontSize: 12.5, color: colors.textFaint, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              with {activeThread.otherName} · {activeItem.seller.rating} · {activeItem.dist} away
            </div>
          </div>
          <div style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 20, color: colors.clay, flex: "none" }}>{activeItem.price}</div>
        </div>

        <div className="bd-chat-body" style={{ flex: 1, padding: "24px 26px", display: "flex", flexDirection: "column", gap: 14, background: "radial-gradient(circle at 80% 10%,#F6EEDD 0%,#FBF6ED 55%)" }}>
          {convo.loading && <div style={{ alignSelf: "center", fontSize: 12.5, fontWeight: 700, color: colors.textFaint }}>Loading messages…</div>}

          {!convo.loading && timeline.length === 0 && (
            <div style={{ alignSelf: "center", background: "#EFE7DA", color: colors.textMuted, fontSize: 12.5, fontWeight: 700, borderRadius: 999, padding: "6px 16px" }}>
              No messages yet — break the ice 👋
            </div>
          )}

          {timeline.map((e, i) => {
            const dayPill = dayLabel(e.at, timeline[i - 1]?.at);
            return (
              <div key={"msg" in e ? e.msg.id : e.offer.id} style={{ display: "contents" }}>
                {dayPill && (
                  <div style={{ alignSelf: "center", background: "#EFE7DA", color: colors.textMuted, fontSize: 11.5, fontWeight: 700, borderRadius: 999, padding: "4px 14px" }}>
                    {dayPill}
                  </div>
                )}
                {"msg" in e ? (
                  <MessageBubble msg={e.msg} />
                ) : (
                  <OfferCard
                    offer={e.offer}
                    otherName={activeThread.otherName}
                    isLatest={e.offer.id === latestOffer?.id}
                    onRespond={respond}
                  />
                )}
              </div>
            );
          })}

          {latestOffer?.status === "accepted" && (
            <div style={{ alignSelf: "flex-start", background: colors.sage, borderRadius: 16, padding: "14px 18px", maxWidth: 400, animation: "bd-pop .35s ease-out" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: colors.pine, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>📍 Meet-up suggestion</div>
              <div style={{ fontWeight: 800, fontSize: 14.5, color: colors.pineDark }}>{activeItem.pickup || "A public spot nearby"}</div>
              <div style={{ fontSize: 12.5, color: colors.pineMuted, margin: "2px 0 10px" }}>Pick a time that works · public spot, well lit</div>
              <div style={{ display: "flex", gap: 8 }}>
                <MeetupChip label="Works for me ✓" primary onClick={() => send("That meet-up spot works for me ✓")} />
                <MeetupChip label="Suggest another" onClick={() => send("Could we meet somewhere else?")} />
              </div>
            </div>
          )}

          {dealOffer && !myReview.loading && (
            myReview.data ? (
              <div style={{ alignSelf: "center", background: "#EFE7DA", color: colors.textMuted, fontSize: 12, fontWeight: 700, borderRadius: 999, padding: "5px 14px" }}>
                You rated {activeThread.otherName} ★ {myReview.data.rating}
              </div>
            ) : (
              <ReviewCard
                otherName={activeThread.otherName}
                onSubmit={async (rating, body) => {
                  await submitReview({
                    offerId: dealOffer.id,
                    chatId: activeThread.id,
                    listingId: activeThread.itemId,
                    subjectId: me?.id === activeThread.buyerId ? activeThread.sellerId : activeThread.buyerId,
                    rating,
                    body,
                  });
                  myReview.reload();
                }}
              />
            )
          )}

          {error && <div style={{ alignSelf: "center", fontSize: 12.5, fontWeight: 700, color: colors.terracotta }}>{error}</div>}
        </div>

        <div className="bd-chat-input" style={{ padding: "16px 26px", borderTop: `1.5px dashed ${colors.divider}`, background: colors.bg }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
            {quickReplyTexts.map((t) => (
              <QuickReplyChip key={t} text={t} onSend={() => send(t)} />
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
              <input
                value={offerDraft}
                onChange={(e) => setOfferDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitOffer();
                }}
                placeholder="offer ₹"
                style={{
                  width: 92,
                  background: "#fff",
                  border: `1.5px solid ${colors.sand}`,
                  borderRadius: 999,
                  padding: "7px 14px",
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: colors.clay,
                  outline: "none",
                }}
              />
              <QuickReplyChip text="Make offer" onSend={submitOffer} />
            </div>
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

/** A "Today"/"Mon, 4:12 PM" separator, only when the day changes. */
function dayLabel(at: string, prev?: string): string | null {
  const d = new Date(at);
  if (prev && new Date(prev).toDateString() === d.toDateString()) return null;
  const today = new Date().toDateString() === d.toDateString();
  const day = today ? "Today" : d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
  return `${day}, ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

/** Appears once a deal is accepted — the only way a rating ever gets created. */
function ReviewCard({ otherName, onSubmit }: { otherName: string; onSubmit: (rating: number, body: string) => Promise<void> }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!rating || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(rating, body);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Couldn't save that rating.");
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        alignSelf: "center",
        width: "min(420px, 100%)",
        background: "#fff",
        border: `1.5px solid ${colors.cardBorder}`,
        borderRadius: 18,
        padding: "16px 20px",
        textAlign: "center",
        animation: "bd-pop .3s ease-out",
      }}
    >
      <div style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 16, marginBottom: 2 }}>
        How did it go with {otherName}?
      </div>
      <div style={{ fontSize: 12.5, color: colors.textFaint, fontWeight: 600, marginBottom: 10 }}>
        Your rating shows on their profile.
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 12 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            role="button"
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            style={{ fontSize: 26, cursor: "pointer", lineHeight: 1, color: n <= (hover || rating) ? colors.marigold : colors.sand }}
          >
            ★
          </span>
        ))}
      </div>
      <input
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") send();
        }}
        placeholder="Add a line about the meet-up (optional)"
        style={{
          width: "100%",
          background: colors.bg,
          border: `1.5px solid ${colors.sand}`,
          borderRadius: 12,
          padding: "10px 14px",
          fontSize: 13.5,
          color: colors.ink,
          outline: "none",
          fontFamily: "inherit",
          marginBottom: 10,
        }}
      />
      {error && <div style={{ fontSize: 12, fontWeight: 700, color: colors.terracotta, marginBottom: 8 }}>{error}</div>}
      <div
        onClick={send}
        style={{
          background: rating ? colors.ink : colors.sand,
          color: rating ? colors.bg : colors.textFaint,
          borderRadius: 999,
          padding: "10px 0",
          fontWeight: 800,
          fontSize: 13.5,
          cursor: rating ? "pointer" : "not-allowed",
        }}
      >
        {busy ? "Saving…" : "Leave rating"}
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  return (
    <div
      style={
        msg.mine
          ? {
              alignSelf: "flex-end",
              maxWidth: 420,
              background: colors.ink,
              color: colors.bg,
              borderRadius: "18px 4px 18px 18px",
              padding: "12px 16px",
              fontSize: 14.5,
              lineHeight: 1.55,
            }
          : {
              alignSelf: "flex-start",
              maxWidth: 420,
              background: "#fff",
              border: `1.5px solid ${colors.cardBorder}`,
              borderRadius: "4px 18px 18px 18px",
              padding: "12px 16px",
              fontSize: 14.5,
              lineHeight: 1.55,
            }
      }
    >
      {msg.body}
    </div>
  );
}

function OfferCard({
  offer,
  otherName,
  isLatest,
  onRespond,
}: {
  offer: ChatOffer;
  otherName: string;
  isLatest: boolean;
  onRespond: (offer: ChatOffer, status: "accepted" | "declined") => void;
}) {
  if (offer.status === "accepted") {
    return (
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
        <div style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 18, color: colors.pine }}>Deal at {offer.amount}!</div>
        <div style={{ fontSize: 12.5, color: colors.pineMuted, fontWeight: 600 }}>
          {offer.mine ? `${otherName} accepted your offer` : `You accepted ${otherName}'s offer`}
        </div>
      </div>
    );
  }

  if (offer.status === "declined") {
    return (
      <div style={{ alignSelf: "center", background: "#EFE7DA", color: colors.textMuted, fontSize: 12, fontWeight: 700, borderRadius: 999, padding: "5px 14px" }}>
        Offer of {offer.amount} declined
      </div>
    );
  }

  return (
    <div
      style={{
        alignSelf: offer.mine ? "flex-end" : "flex-start",
        background: colors.offerBg,
        border: `1.5px dashed ${colors.offerBorder}`,
        borderRadius: 16,
        padding: "14px 18px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, color: colors.offerText, textTransform: "uppercase", letterSpacing: ".5px" }}>
          {offer.mine ? "Your offer" : `${otherName}'s offer`}
        </div>
        <div style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 22, color: colors.clay }}>{offer.amount}</div>
      </div>
      {offer.mine ? (
        <div style={{ fontSize: 12.5, color: colors.offerText, fontWeight: 700 }}>waiting for {otherName}…</div>
      ) : isLatest ? (
        <div style={{ display: "flex", gap: 8 }}>
          <OfferButton label="Accept ✓" primary onClick={() => onRespond(offer, "accepted")} />
          <OfferButton label="Decline" onClick={() => onRespond(offer, "declined")} />
        </div>
      ) : (
        <div style={{ fontSize: 12.5, color: colors.offerText, fontWeight: 700 }}>superseded</div>
      )}
    </div>
  );
}

function ChatListRow({
  thread,
  cover,
  active,
  onOpen,
}: {
  thread: Thread;
  cover?: string;
  active: boolean;
  onOpen: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ display: "flex", gap: 12, padding: "13px 22px", cursor: "pointer", background: hover || active ? "#F6EEDD" : "transparent" }}
    >
      <div style={{ position: "relative", flex: "none" }}>
        <Stripe angle={thread.angle} src={cover} band={6} style={{ width: 46, height: 46, borderRadius: 14 }} />
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
        <div style={{ fontSize: 12.5, color: colors.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{thread.last}</div>
      </div>
    </div>
  );
}

function OfferButton({ label, primary, onClick }: { label: string; primary?: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: primary ? (hover ? colors.teal : colors.pine) : "#fff",
        color: primary ? "#fff" : colors.textBody,
        border: primary ? "none" : `1.5px solid ${colors.sand}`,
        borderRadius: 999,
        padding: "8px 18px",
        fontSize: 13,
        fontWeight: 800,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  );
}

function MeetupChip({ label, primary, onClick }: { label: string; primary?: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
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
