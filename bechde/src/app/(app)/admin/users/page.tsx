"use client";

import { useState } from "react";
import { colors } from "@/lib/colors";
import {
  adminSetSuspension,
  adminUpdateProfile,
  formatRating,
  useAdminProfiles,
  type AdminProfileRow,
} from "@/lib/queries";
import { listedAgo } from "@/lib/time";
import { H1, MiniButton, Pill, card, input, label, useReasonPrompt } from "../_shared";

export default function AdminUsersPage() {
  const [query, setQuery] = useState("");
  const rows = useAdminProfiles(query);
  const [editing, setEditing] = useState<string | null>(null);
  const [ask, dialog] = useReasonPrompt(() => {
    rows.reload();
    setEditing(null);
  });

  return (
    <>
      <H1 sub="Renaming someone is a real intervention. It's logged with your reason and it isn't reversible from their side.">
        People
      </H1>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or email…"
        aria-label="Search people"
        style={{ ...input, maxWidth: 420, marginBottom: 20 }}
      />

      {rows.loading && <div style={{ color: colors.textFaint, fontWeight: 700 }}>Loading…</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {(rows.data ?? []).map((p) => (
          <div key={p.id} style={{ ...card, borderColor: p.suspendedAt ? colors.offerBorder : colors.cardBorder }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                  <span style={{ fontWeight: 800, fontSize: 15 }}>{p.name}</span>
                  {p.isAdmin && <Pill tone="good">admin</Pill>}
                  {p.suspendedAt && <Pill tone="warn">suspended</Pill>}
                </div>
                <div style={{ fontSize: 12.5, color: colors.textMuted, fontWeight: 600 }}>
                  {p.email ?? "no email"} · {formatRating(p.ratingAvg, p.ratingCount)} · {p.sold} sold · joined{" "}
                  {listedAgo(p.createdAt, "just now")}
                </div>
                {p.suspendedReason && (
                  <div style={{ fontSize: 12.5, color: colors.offerText, fontWeight: 700, marginTop: 4 }}>
                    Suspended: {p.suspendedReason}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <MiniButton onClick={() => setEditing(editing === p.id ? null : p.id)}>
                  {editing === p.id ? "Close" : "Edit"}
                </MiniButton>
                {p.suspendedAt ? (
                  <MiniButton
                    onClick={() =>
                      ask({
                        title: `Lift the suspension on ${p.name}?`,
                        confirmLabel: "Lift",
                        run: (reason) => adminSetSuspension(p.id, false, reason),
                      })
                    }
                  >
                    Unsuspend
                  </MiniButton>
                ) : (
                  <MiniButton
                    tone="danger"
                    onClick={() =>
                      ask({
                        title: `Suspend ${p.name}?`,
                        detail:
                          "They can still sign in and read, but cannot post a listing, send a message or make an offer. Their listings stop appearing.",
                        confirmLabel: "Suspend",
                        run: (reason) => adminSetSuspension(p.id, true, reason),
                      })
                    }
                  >
                    Suspend
                  </MiniButton>
                )}
              </div>
            </div>

            {editing === p.id && <ProfileEditor row={p} ask={ask} />}
          </div>
        ))}
      </div>
      {dialog}
    </>
  );
}

function ProfileEditor({
  row,
  ask,
}: {
  row: AdminProfileRow;
  ask: (p: { title: string; detail?: string; confirmLabel?: string; run: (r: string) => Promise<unknown> }) => void;
}) {
  const [name, setName] = useState(row.name);
  const [bio, setBio] = useState(row.bio ?? "");

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: `2px dashed ${colors.divider}` }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <div style={{ minWidth: 0 }}>
          <div style={label}>Display name</div>
          <input aria-label="Display name" value={name} onChange={(e) => setName(e.target.value)} style={input} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={label}>Bio</div>
          <input aria-label="Bio" value={bio} onChange={(e) => setBio(e.target.value)} style={input} />
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: colors.textFaint, fontWeight: 600, marginTop: 10, lineHeight: 1.5 }}>
        Rating, items sold and reply time aren&apos;t editable — they&apos;re derived from reviews and real
        message timings by trigger, so typing a number here would be inventing one.
      </div>
      <div style={{ marginTop: 16 }}>
        <MiniButton
          tone="go"
          onClick={() =>
            ask({
              title: `Save changes to ${row.name}?`,
              confirmLabel: "Save",
              run: (reason) => adminUpdateProfile(row.id, { name, bio: bio.trim() || null }, reason),
            })
          }
        >
          Save changes
        </MiniButton>
      </div>
    </div>
  );
}
