"use client";

import { useState } from "react";
import { colors } from "@/lib/colors";
import { useAuditLog, type AuditEntry } from "@/lib/queries";
import { listedAgo } from "@/lib/time";
import { H1, MiniButton, Pill, card } from "../_shared";

/** Fields that change on every write and would drown the real diff. */
const NOISE = new Set(["search", "price_num", "created_at"]);

function diff(before: Record<string, unknown> | null, after: Record<string, unknown> | null) {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const out: { key: string; from: unknown; to: unknown }[] = [];
  for (const k of keys) {
    if (NOISE.has(k)) continue;
    const a = before?.[k];
    const b = after?.[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ key: k, from: a, to: b });
  }
  return out;
}

const show = (v: unknown) =>
  v === null || v === undefined ? "—" : typeof v === "string" ? v : JSON.stringify(v);

export default function AdminAuditPage() {
  const [action, setAction] = useState("");
  const log = useAuditLog(action ? { action } : {});
  const [open, setOpen] = useState<string | null>(null);

  return (
    <>
      <H1 sub="Every admin write, with who did it and why. Nothing here can be edited or deleted from the app.">
        Audit log
      </H1>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {["", "listing", "profile", "category", "attribute", "report", "review", "locality", "city"].map((a) => (
          <MiniButton key={a || "all"} tone={action === a ? "go" : "plain"} onClick={() => setAction(a)}>
            {a || "everything"}
          </MiniButton>
        ))}
      </div>

      {log.loading && <div style={{ color: colors.textFaint, fontWeight: 700 }}>Loading…</div>}

      {!log.loading && (log.data ?? []).length === 0 && (
        <div style={{ color: colors.textMuted, fontWeight: 700 }}>No entries.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(log.data ?? []).map((e) => (
          <Entry key={e.id} entry={e} open={open === e.id} onToggle={() => setOpen(open === e.id ? null : e.id)} />
        ))}
      </div>
    </>
  );
}

function Entry({ entry, open, onToggle }: { entry: AuditEntry; open: boolean; onToggle: () => void }) {
  const changes = diff(entry.before, entry.after);
  return (
    <div style={card}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          all: "unset",
          cursor: "pointer",
          display: "flex",
          gap: 10,
          alignItems: "baseline",
          flexWrap: "wrap",
          width: "100%",
        }}
      >
        <Pill tone={entry.action.includes("suspend") || entry.action.includes("remove") ? "warn" : "muted"}>
          {entry.action}
        </Pill>
        <span style={{ fontWeight: 800, fontSize: 13.5, minWidth: 0, wordBreak: "break-all" }}>
          {entry.targetTable}/{entry.targetId.slice(0, 20)}
        </span>
        <span style={{ fontSize: 13, color: colors.textMuted, fontWeight: 600, flex: 1, minWidth: 120 }}>
          “{entry.reason}”
        </span>
        <span style={{ fontSize: 12, color: colors.textFaint, fontWeight: 700, whiteSpace: "nowrap" }}>
          {entry.actorName ?? "someone"} · {listedAgo(entry.createdAt, "just now")}
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `2px dashed ${colors.divider}`, overflowX: "auto" }}>
          {changes.length === 0 ? (
            <div style={{ fontSize: 13, color: colors.textFaint, fontWeight: 600 }}>
              No field-level change recorded{entry.after === null ? " — the row was deleted." : "."}
            </div>
          ) : (
            <table style={{ borderCollapse: "collapse", fontSize: 13, minWidth: 420 }}>
              <thead>
                <tr style={{ textAlign: "left", color: colors.textFaint }}>
                  <th style={{ padding: "4px 14px 4px 0", fontWeight: 800 }}>Field</th>
                  <th style={{ padding: "4px 14px 4px 0", fontWeight: 800 }}>Was</th>
                  <th style={{ padding: "4px 0", fontWeight: 800 }}>Now</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((c) => (
                  <tr key={c.key} style={{ borderTop: `1px solid ${colors.cardBorder}` }}>
                    <td style={{ padding: "6px 14px 6px 0", fontWeight: 700 }}>{c.key}</td>
                    <td style={{ padding: "6px 14px 6px 0", color: colors.textMuted }}>{show(c.from)}</td>
                    <td style={{ padding: "6px 0", fontWeight: 700 }}>{show(c.to)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
