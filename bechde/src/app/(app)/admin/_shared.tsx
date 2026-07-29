"use client";

/**
 * Shared furniture for the admin console.
 *
 * The important one is `useReasonPrompt`. Every admin RPC requires a reason — the
 * check constraint on admin_actions rejects anything shorter than three characters —
 * so rather than let a write fail at the database and surface a Postgres error, the
 * UI asks first. The prompt is the reason field made visible: if you can't say why,
 * you don't get to do it.
 */

import { CSSProperties, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { colors } from "@/lib/colors";

export const card: CSSProperties = {
  background: "#fff",
  border: `1.5px solid ${colors.cardBorder}`,
  borderRadius: 18,
  padding: "18px 22px",
};

export const label: CSSProperties = {
  fontWeight: 800,
  fontSize: 12,
  letterSpacing: ".04em",
  textTransform: "uppercase",
  color: colors.textMuted,
  marginBottom: 6,
};

export const input: CSSProperties = {
  width: "100%",
  minWidth: 0,
  background: "#fff",
  border: `1.5px solid ${colors.sand}`,
  borderRadius: 12,
  padding: "11px 14px",
  fontSize: 14,
  fontWeight: 600,
  fontFamily: "inherit",
  color: colors.ink,
  outline: "none",
};

export function H1({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h1
        style={{
          margin: "0 0 6px",
          fontFamily: "var(--font-bricolage)",
          fontWeight: 800,
          fontSize: 30,
          letterSpacing: "-.7px",
        }}
      >
        {children}
      </h1>
      {sub && <div style={{ fontSize: 13.5, color: colors.textMuted, fontWeight: 600 }}>{sub}</div>}
    </div>
  );
}

/** A small square-ish button that doesn't need the full pill treatment. */
export function MiniButton({
  children,
  onClick,
  tone = "plain",
  disabled,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "plain" | "danger" | "go";
  disabled?: boolean;
  style?: CSSProperties;
}) {
  const tones: Record<string, CSSProperties> = {
    plain: { background: "#fff", color: colors.ink, borderColor: colors.sand },
    danger: { background: "#fff", color: colors.clay, borderColor: colors.sand },
    go: { background: colors.ink, color: colors.bg, borderColor: colors.ink },
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        borderRadius: 999,
        border: "1.5px solid",
        padding: "8px 16px",
        fontSize: 13,
        fontWeight: 800,
        fontFamily: "inherit",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        ...tones[tone],
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Pill({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "warn" | "bad" | "good" }) {
  const tones: Record<string, CSSProperties> = {
    muted: { background: colors.bg3, color: colors.textDark },
    warn: { background: colors.offerBg, color: colors.offerText },
    bad: { background: colors.terracotta, color: "#fff" },
    good: { background: colors.sage, color: colors.pine },
  };
  return (
    <span
      style={{
        borderRadius: 999,
        padding: "3px 10px",
        fontSize: 11,
        fontWeight: 800,
        whiteSpace: "nowrap",
        ...tones[tone],
      }}
    >
      {children}
    </span>
  );
}

interface Pending {
  title: string;
  detail?: string;
  confirmLabel?: string;
  run: (reason: string) => Promise<unknown>;
}

/**
 * Returns [ask, dialog]. Call `ask({title, run})` to collect a reason and then run
 * the action; render `dialog` somewhere in the tree.
 */
export function useReasonPrompt(onDone?: () => void): [(p: Pending) => void, ReactNode] {
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pending) fieldRef.current?.focus();
  }, [pending]);

  const close = useCallback(() => {
    setPending(null);
    setReason("");
    setError(null);
    setBusy(false);
  }, []);

  const submit = useCallback(async () => {
    if (!pending || busy) return;
    if (reason.trim().length < 3) {
      setError("Say why — this goes in the log.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await pending.run(reason.trim());
      close();
      onDone?.();
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "That didn't work.");
    }
  }, [pending, reason, busy, close, onDone]);

  const ask = useCallback((p: Pending) => {
    setPending(p);
    setReason("");
    setError(null);
  }, []);

  const dialog = pending ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={pending.title}
      onKeyDown={(e) => {
        if (e.key === "Escape") close();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(46,42,36,.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 200,
      }}
    >
      <div
        style={{
          background: colors.bg,
          border: `1.5px solid ${colors.cardBorder}`,
          borderRadius: 20,
          padding: "24px 26px",
          width: 460,
          maxWidth: "100%",
          minWidth: 0,
          boxShadow: "0 24px 60px rgba(60,45,20,.2)",
        }}
      >
        <div style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 20, marginBottom: 6 }}>
          {pending.title}
        </div>
        {pending.detail && (
          <div style={{ fontSize: 13.5, color: colors.textMuted, fontWeight: 600, marginBottom: 14, lineHeight: 1.5 }}>
            {pending.detail}
          </div>
        )}
        <div style={label}>Reason (recorded in the audit log)</div>
        <input
          ref={fieldRef}
          aria-label="Reason for this action"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="e.g. counterfeit — matches a reported brand"
          style={input}
        />
        {error && (
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.terracotta, marginTop: 10 }}>{error}</div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
          <MiniButton onClick={close} disabled={busy}>
            Cancel
          </MiniButton>
          <MiniButton tone="go" onClick={submit} disabled={busy}>
            {busy ? "Working…" : (pending.confirmLabel ?? "Confirm")}
          </MiniButton>
        </div>
      </div>
    </div>
  ) : null;

  return [ask, dialog];
}
