"use client";

import { useState } from "react";
import { colors } from "@/lib/colors";
import {
  adminDeleteAttribute,
  adminDeleteLocality,
  adminUpsertAttribute,
  adminUpsertCategory,
  adminUpsertCity,
  adminUpsertLocality,
  useCategories,
  useCategoryAttributes,
  useCities,
} from "@/lib/queries";
import { H1, MiniButton, Pill, card, input, label, useReasonPrompt } from "../_shared";

type Tab = "categories" | "places" | "attributes";

export default function AdminTaxonomyPage() {
  const [tab, setTab] = useState<Tab>("categories");
  return (
    <>
      <H1 sub="What the sell form offers, and what it asks for. Changes take effect immediately.">Taxonomy</H1>
      <div style={{ display: "flex", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
        {(["categories", "places", "attributes"] as Tab[]).map((t) => (
          <MiniButton key={t} tone={tab === t ? "go" : "plain"} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </MiniButton>
        ))}
      </div>
      {tab === "categories" && <Categories />}
      {tab === "places" && <Places />}
      {tab === "attributes" && <Attributes />}
    </>
  );
}

// ---------------------------------------------------------------------------

function Categories() {
  const cats = useCategories();
  const [ask, dialog] = useReasonPrompt(() => window.location.reload());
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");

  return (
    <>
      <div style={{ ...card, marginBottom: 18, maxWidth: 620 }}>
        <div style={{ fontWeight: 800, marginBottom: 12 }}>Add a category</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: 2, minWidth: 160 }}>
            <div style={label}>Name</div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bicycles" style={input} />
          </div>
          <div style={{ flex: 1, minWidth: 90 }}>
            <div style={label}>Icon</div>
            <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="🚲" style={input} />
          </div>
          <MiniButton
            tone="go"
            disabled={!name.trim()}
            onClick={() =>
              ask({
                title: `Add the category “${name}”?`,
                confirmLabel: "Add",
                run: (reason) => adminUpsertCategory(name.trim(), icon.trim(), 500, true, reason),
              })
            }
          >
            Add
          </MiniButton>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(cats.data ?? []).map((c) => (
          <div key={c.name} style={{ ...card, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 20 }}>{c.icon}</span>
            <span style={{ fontWeight: 800, flex: 1, minWidth: 120 }}>{c.name}</span>
            <span style={{ fontSize: 12.5, color: colors.textFaint, fontWeight: 700 }}>sort {c.sort}</span>
            <MiniButton
              tone="danger"
              onClick={() =>
                ask({
                  title: `Retire “${c.name}”?`,
                  detail:
                    "It stops being offered on the sell form. Existing listings keep the category — retiring is not deleting, because a foreign key points at this name.",
                  confirmLabel: "Retire",
                  run: (reason) => adminUpsertCategory(c.name, c.icon ?? "", c.sort, false, reason),
                })
              }
            >
              Retire
            </MiniButton>
          </div>
        ))}
      </div>
      {dialog}
    </>
  );
}

// ---------------------------------------------------------------------------

function Places() {
  const cities = useCities();
  const [ask, dialog] = useReasonPrompt(() => window.location.reload());
  const [form, setForm] = useState({ id: "", name: "", state: "", lat: "", lng: "" });
  const [loc, setLoc] = useState({ city: "", name: "", lat: "", lng: "" });

  return (
    <>
      <div style={{ ...card, marginBottom: 18 }}>
        <div style={{ fontWeight: 800, marginBottom: 4 }}>Add a city</div>
        <div style={{ fontSize: 12.5, color: colors.textMuted, fontWeight: 600, marginBottom: 12 }}>
          Coordinates are the city centre — they seed the map when someone picks it.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
          {(["id", "name", "state", "lat", "lng"] as const).map((k) => (
            <div key={k} style={{ minWidth: 0 }}>
              <div style={label}>{k}</div>
              <input
                value={form[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                placeholder={k === "id" ? "pune" : k === "lat" ? "18.52" : ""}
                style={input}
              />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14 }}>
          <MiniButton
            tone="go"
            disabled={!form.id.trim() || !form.name.trim() || !form.lat || !form.lng}
            onClick={() =>
              ask({
                title: `Add ${form.name}?`,
                confirmLabel: "Add",
                run: (reason) =>
                  adminUpsertCity(
                    {
                      id: form.id.trim(),
                      name: form.name.trim(),
                      state: form.state.trim() || null,
                      lat: Number(form.lat),
                      lng: Number(form.lng),
                      sort: 500,
                      active: true,
                    },
                    reason
                  ),
              })
            }
          >
            Add city
          </MiniButton>
        </div>
      </div>

      <div style={{ ...card, marginBottom: 18 }}>
        <div style={{ fontWeight: 800, marginBottom: 12 }}>Add a locality</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={label}>City</div>
            <select value={loc.city} onChange={(e) => setLoc({ ...loc, city: e.target.value })} style={input}>
              <option value="">choose…</option>
              {(cities.data ?? []).map(({ city }) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </div>
          {(["name", "lat", "lng"] as const).map((k) => (
            <div key={k} style={{ minWidth: 0 }}>
              <div style={label}>{k}</div>
              <input value={loc[k]} onChange={(e) => setLoc({ ...loc, [k]: e.target.value })} style={input} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14 }}>
          <MiniButton
            tone="go"
            disabled={!loc.city || !loc.name.trim() || !loc.lat || !loc.lng}
            onClick={() =>
              ask({
                title: `Add ${loc.name}?`,
                confirmLabel: "Add",
                run: (reason) =>
                  adminUpsertLocality(
                    { city_id: loc.city, name: loc.name.trim(), lat: Number(loc.lat), lng: Number(loc.lng) },
                    reason
                  ),
              })
            }
          >
            Add locality
          </MiniButton>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {(cities.data ?? []).map(({ city, localities }) => (
          <div key={city.id} style={card}>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap", marginBottom: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 15 }}>{city.name}</span>
              <span style={{ fontSize: 12.5, color: colors.textMuted, fontWeight: 600 }}>{city.state}</span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {localities.length === 0 && (
                <span style={{ fontSize: 13, color: colors.textFaint, fontWeight: 600 }}>No localities yet.</span>
              )}
              {localities.map((l) => (
                <span key={l.id} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Pill>{l.name}</Pill>
                  <MiniButton
                    tone="danger"
                    style={{ padding: "3px 10px", fontSize: 11 }}
                    onClick={() =>
                      ask({
                        title: `Remove ${l.name}?`,
                        confirmLabel: "Remove",
                        run: (reason) => adminDeleteLocality(l.id, reason),
                      })
                    }
                  >
                    ×
                  </MiniButton>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      {dialog}
    </>
  );
}

// ---------------------------------------------------------------------------

function Attributes() {
  const cats = useCategories();
  const all = useCategoryAttributes(null);
  const [ask, dialog] = useReasonPrompt(() => window.location.reload());
  const [f, setF] = useState({ category: "", key: "", labelText: "", type: "text", options: "", hint: "" });

  const universal = (all.data ?? []).filter((a) => !a.category);
  const byCategory = (all.data ?? []).filter((a) => a.category);

  return (
    <>
      <div style={{ ...card, marginBottom: 18 }}>
        <div style={{ fontWeight: 800, marginBottom: 4 }}>Add a question to the sell form</div>
        <div style={{ fontSize: 12.5, color: colors.textMuted, fontWeight: 600, marginBottom: 12, lineHeight: 1.5 }}>
          Leave the category blank to ask it of every listing. The key is what gets stored — lowercase, no
          spaces — and can&apos;t change later without orphaning the answers already given.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={label}>Category</div>
            <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} style={input}>
              <option value="">every category</option>
              {(cats.data ?? []).map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={label}>Key</div>
            <input value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })} placeholder="frame_size" style={input} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={label}>Label</div>
            <input
              value={f.labelText}
              onChange={(e) => setF({ ...f, labelText: e.target.value })}
              placeholder="Frame size"
              style={input}
            />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={label}>Type</div>
            <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} style={input}>
              <option value="text">text</option>
              <option value="number">number</option>
              <option value="select">select</option>
              <option value="boolean">yes/no</option>
            </select>
          </div>
          {f.type === "select" && (
            <div style={{ minWidth: 0 }}>
              <div style={label}>Options (comma separated)</div>
              <input value={f.options} onChange={(e) => setF({ ...f, options: e.target.value })} style={input} />
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={label}>Hint</div>
            <input value={f.hint} onChange={(e) => setF({ ...f, hint: e.target.value })} style={input} />
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <MiniButton
            tone="go"
            disabled={!f.key.trim() || !f.labelText.trim() || (f.type === "select" && !f.options.trim())}
            onClick={() =>
              ask({
                title: `Ask “${f.labelText}” on ${f.category || "every"} listing?`,
                confirmLabel: "Add",
                run: (reason) =>
                  adminUpsertAttribute(
                    {
                      category: f.category || null,
                      key: f.key.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                      label: f.labelText.trim(),
                      type: f.type as "text" | "number" | "select" | "boolean",
                      options: f.options
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                      hint: f.hint.trim() || null,
                      sort: 500,
                    },
                    reason
                  ),
              })
            }
          >
            Add question
          </MiniButton>
        </div>
      </div>

      <AttrList title="Asked of every listing" rows={universal} ask={ask} />
      <AttrList title="Category-specific" rows={byCategory} ask={ask} />
      {dialog}
    </>
  );
}

function AttrList({
  title,
  rows,
  ask,
}: {
  title: string;
  rows: { id: string; category: string | null; key: string; label: string; type: string; options: string[]; required: boolean }[];
  ask: (p: { title: string; detail?: string; confirmLabel?: string; run: (r: string) => Promise<unknown> }) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 17, marginBottom: 10 }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((a) => (
          <div key={a.id} style={{ ...card, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {a.category && <Pill>{a.category}</Pill>}
            <span style={{ fontWeight: 800, minWidth: 120 }}>{a.label}</span>
            <code style={{ fontSize: 12, color: colors.textFaint }}>{a.key}</code>
            <Pill tone="muted">{a.type}</Pill>
            {a.required && <Pill tone="warn">required</Pill>}
            {a.options.length > 0 && (
              <span style={{ fontSize: 12.5, color: colors.textMuted, fontWeight: 600, flex: 1, minWidth: 0 }}>
                {a.options.join(" · ")}
              </span>
            )}
            <MiniButton
              tone="danger"
              onClick={() =>
                ask({
                  title: `Stop asking “${a.label}”?`,
                  detail: "Answers already given stay on their listings — you just stop asking new sellers.",
                  confirmLabel: "Remove",
                  run: (reason) => adminDeleteAttribute(a.id, reason),
                })
              }
            >
              Remove
            </MiniButton>
          </div>
        ))}
      </div>
    </div>
  );
}
