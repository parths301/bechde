"use client";

import { useState } from "react";
import Link from "next/link";
import { colors } from "@/lib/colors";
import {
  adminUpdateListing,
  useAdminListings,
  useCategories,
  useCategoryAttributes,
  type AdminListingRow,
  type ListingPatch,
} from "@/lib/queries";
import { listedAgo } from "@/lib/time";
import { H1, MiniButton, Pill, card, input, label, useReasonPrompt } from "../_shared";

export default function AdminListingsPage() {
  const [query, setQuery] = useState("");
  const rows = useAdminListings(query);
  const [editing, setEditing] = useState<AdminListingRow | null>(null);
  const [ask, dialog] = useReasonPrompt(() => {
    rows.reload();
    setEditing(null);
  });

  return (
    <>
      <H1 sub="Search by name. Editing writes a log entry with your reason attached.">Listings</H1>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search listings…"
        aria-label="Search listings"
        style={{ ...input, maxWidth: 420, marginBottom: 20 }}
      />

      {rows.loading && <div style={{ color: colors.textFaint, fontWeight: 700 }}>Loading…</div>}
      {rows.error && <div style={{ color: colors.terracotta, fontWeight: 700 }}>{rows.error}</div>}

      {!rows.loading && (rows.data ?? []).length === 0 && (
        <div style={{ color: colors.textMuted, fontWeight: 700 }}>Nothing matches “{query}”.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {(rows.data ?? []).map((r) => (
          <div key={r.id} style={card}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                  <span style={{ fontWeight: 800, fontSize: 15 }}>{r.name}</span>
                  {r.status !== "active" && <Pill tone={r.status === "removed" ? "bad" : "muted"}>{r.status}</Pill>}
                </div>
                <div style={{ fontSize: 12.5, color: colors.textMuted, fontWeight: 600 }}>
                  {r.price} · {r.category} · {r.sellerName ?? "unknown seller"} ·{" "}
                  {listedAgo(r.createdAt, "just now")}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <MiniButton onClick={() => setEditing(editing?.id === r.id ? null : r)}>
                  {editing?.id === r.id ? "Close" : "Edit"}
                </MiniButton>
                {r.status !== "removed" ? (
                  <MiniButton
                    tone="danger"
                    onClick={() =>
                      ask({
                        title: `Withdraw “${r.name}”?`,
                        detail: "The listing stops appearing. Its chat history survives.",
                        confirmLabel: "Withdraw",
                        run: (reason) => adminUpdateListing(r.id, { status: "removed" }, reason),
                      })
                    }
                  >
                    Withdraw
                  </MiniButton>
                ) : (
                  <MiniButton
                    onClick={() =>
                      ask({
                        title: `Restore “${r.name}”?`,
                        confirmLabel: "Restore",
                        run: (reason) => adminUpdateListing(r.id, { status: "active" }, reason),
                      })
                    }
                  >
                    Restore
                  </MiniButton>
                )}
                <Link
                  href={`/product/${r.id}`}
                  style={{ fontSize: 13, fontWeight: 800, color: colors.clay, textDecoration: "none", alignSelf: "center" }}
                >
                  View →
                </Link>
              </div>
            </div>

            {editing?.id === r.id && (
              <ListingEditor
                row={r}
                onSave={(patch, title) =>
                  ask({
                    title,
                    detail: "Sellers aren't notified of admin edits, so say why here.",
                    confirmLabel: "Save",
                    run: (reason) => adminUpdateListing(r.id, patch, reason),
                  })
                }
              />
            )}
          </div>
        ))}
      </div>
      {dialog}
    </>
  );
}

function ListingEditor({
  row,
  onSave,
}: {
  row: AdminListingRow;
  onSave: (patch: ListingPatch, title: string) => void;
}) {
  const cats = useCategories();
  const [name, setName] = useState(row.name);
  const [price, setPrice] = useState(row.price);
  const [category, setCategory] = useState(row.category);
  const [note, setNote] = useState("");
  const attrs = useCategoryAttributes(category);

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: `2px dashed ${colors.divider}` }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <Field text="Name">
          <input aria-label="Listing name" value={name} onChange={(e) => setName(e.target.value)} style={input} />
        </Field>
        <Field text="Price">
          <input aria-label="Listing price" value={price} onChange={(e) => setPrice(e.target.value)} style={input} />
        </Field>
        <Field text="Category">
          <select
            aria-label="Listing category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={input}
          >
            {(cats.data ?? []).map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div style={{ marginTop: 14 }}>
        <Field text="Moderation note on the listing (leave blank to clear)">
          <input
            aria-label="Moderation note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Shown to buyers under the title"
            style={input}
          />
        </Field>
      </div>

      {(attrs.data ?? []).length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12.5, color: colors.textFaint, fontWeight: 600 }}>
          {category} asks for: {(attrs.data ?? []).map((a) => a.label).join(", ")}. Sellers fill these in; edit
          the values on the listing itself.
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <MiniButton
          tone="go"
          onClick={() =>
            onSave(
              { name, price, category, note: note.trim() || null },
              `Save changes to “${row.name}”?`
            )
          }
        >
          Save changes
        </MiniButton>
      </div>
    </div>
  );
}

function Field({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={label}>{text}</div>
      {children}
    </div>
  );
}
