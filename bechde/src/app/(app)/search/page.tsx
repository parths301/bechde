"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { colors } from "@/lib/colors";
import {
  useSearchResults,
  useSavedSearches,
  saveSearch,
  deleteSavedSearch,
  type SavedSearch,
} from "@/lib/queries";
import {
  ANY_CATEGORY,
  describeFilters,
  filtersFromParams,
  searchCategories,
  searchHref,
  type Filters,
} from "@/lib/search";
import ListingCard from "@/components/ListingCard";
import Chip from "@/components/Chip";
import PriceInput from "@/components/PriceInput";

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div style={{ flex: 1, display: "grid", placeItems: "center", minHeight: "calc(100vh - 76px)", color: colors.textFaint, fontWeight: 700 }}>
          Searching…
        </div>
      }
    >
      <SearchScreen />
    </Suspense>
  );
}

function SearchScreen() {
  const router = useRouter();
  const params = useSearchParams();
  // The URL is the single source of truth, so results are shareable and Back works.
  const filters = filtersFromParams(new URLSearchParams(params.toString()));
  const { data, loading } = useSearchResults(filters);
  const saved = useSavedSearches();
  const results = data ?? [];

  const [queryDraft, setQueryDraft] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  const apply = (next: Partial<Filters>) => {
    setQueryDraft(null);
    setSaveState("idle");
    router.push(searchHref({ ...filters, ...next }));
  };

  const onSave = async () => {
    setError(null);
    setSaveState("saving");
    try {
      await saveSearch(filters);
      saved.reload();
      setSaveState("saved");
    } catch (e: unknown) {
      setSaveState("idle");
      setError(e instanceof Error ? e.message : "Couldn't save that search.");
    }
  };

  const onForget = async (s: SavedSearch) => {
    setError(null);
    try {
      await deleteSavedSearch(s.id);
      saved.reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Couldn't remove that search.");
    }
  };

  return (
    <div className="bd-map-grid" style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 320px", minHeight: "calc(100vh - 76px)" }}>
      <div style={{ padding: "26px 36px 44px", maxWidth: 1240 }}>
        <h1 style={{ margin: "0 0 4px", fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 28, letterSpacing: "-.7px" }}>
          {filters.q.trim() ? `“${filters.q.trim()}”` : "Everything nearby"}
        </h1>
        <div style={{ fontSize: 13.5, color: colors.textMuted, fontWeight: 600, marginBottom: 20 }}>
          {loading ? "Looking…" : describeFilters(filters, results.length)}
        </div>

        {!loading && results.length === 0 && (
          <div style={{ background: "#fff", border: `1.5px dashed ${colors.cardBorder}`, borderRadius: 18, padding: "28px 26px", maxWidth: 520 }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>🔍</div>
            <div style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 19, marginBottom: 6 }}>Nothing matches — yet</div>
            <div style={{ fontSize: 13.5, color: colors.textBody, lineHeight: 1.6 }}>
              Try a wider radius, drop the price bound, or search a broader word. You can also save this search and we&apos;ll
              count new matches here as people list things.
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              {filters.radiusKm < 10 && <MiniButton label="Widen to 10 km" onClick={() => apply({ radiusKm: 10 })} />}
              {(filters.minPrice != null || filters.maxPrice != null) && (
                <MiniButton label="Clear price" onClick={() => apply({ minPrice: null, maxPrice: null })} />
              )}
              {filters.category !== ANY_CATEGORY && <MiniButton label="Any category" onClick={() => apply({ category: ANY_CATEGORY })} />}
            </div>
          </div>
        )}

        <div className="bd-feed-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18 }}>
          {results.map((item) => (
            <ListingCard key={item.id} item={item} />
          ))}
        </div>
      </div>

      {/* filter rail — same shell as the map's, so it reuses the responsive rules */}
      <div className="bd-map-rail" style={{ borderLeft: `1.5px dashed ${colors.divider}`, padding: "26px 24px", display: "flex", flexDirection: "column", gap: 22, background: colors.bg }}>
        <div>
          <RailTitle>Search</RailTitle>
          <input
            value={queryDraft ?? filters.q}
            onChange={(e) => setQueryDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") apply({ q: queryDraft ?? filters.q });
            }}
            placeholder="study table, iPhone 12…"
            style={{
              width: "100%",
              background: "#fff",
              border: `1.5px solid ${colors.sand}`,
              borderRadius: 12,
              padding: "11px 15px",
              fontSize: 14,
              fontWeight: 600,
              color: colors.ink,
              outline: "none",
            }}
          />
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <RailTitle inline>Radius</RailTitle>
            <span style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 16, color: colors.clay }}>{filters.radiusKm} km</span>
          </div>
          <input
            type="range"
            aria-label="Search radius in kilometres"
            min={1}
            max={10}
            value={filters.radiusKm}
            onChange={(e) => apply({ radiusKm: Number(e.target.value) })}
            style={{ width: "100%", cursor: "pointer" }}
          />
        </div>

        <div>
          <RailTitle>Category</RailTitle>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {searchCategories.map((c) => (
              <Chip key={c.name} icon={c.icon} name={c.name} active={filters.category === c.name} onClick={() => apply({ category: c.name })} />
            ))}
          </div>
        </div>

        <div>
          <RailTitle>Price</RailTitle>
          <div style={{ display: "flex", gap: 8 }}>
            <PriceInput placeholder="₹ min" value={filters.minPrice} onCommit={(v) => apply({ minPrice: v })} />
            <PriceInput placeholder="₹ max" value={filters.maxPrice} onCommit={(v) => apply({ maxPrice: v })} />
          </div>
        </div>

        <div
          onClick={saveState === "saved" ? undefined : onSave}
          style={{
            textAlign: "center",
            background: saveState === "saved" ? colors.sage : "#fff",
            color: saveState === "saved" ? colors.pine : colors.ink,
            border: `2px solid ${saveState === "saved" ? colors.sageBorder : colors.ink}`,
            borderRadius: 999,
            padding: "11px 0",
            fontWeight: 800,
            fontSize: 13.5,
            cursor: saveState === "saved" ? "default" : "pointer",
          }}
        >
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "✓ Search saved" : "♡ Save this search"}
        </div>

        {error && <div style={{ fontSize: 12, fontWeight: 700, color: colors.terracotta }}>{error}</div>}

        {(saved.data?.length ?? 0) > 0 && (
          <div>
            <RailTitle>Saved searches</RailTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {saved.data!.map((s) => (
                <SavedRow key={s.id} search={s} onOpen={() => router.push(searchHref(s))} onForget={() => onForget(s)} />
              ))}
            </div>
            <div style={{ fontSize: 11, color: colors.textFaint, fontWeight: 600, marginTop: 8, lineHeight: 1.5 }}>
              New matches are counted here — no emails yet.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RailTitle({ children, inline }: { children: React.ReactNode; inline?: boolean }) {
  return (
    <div style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 16, marginBottom: inline ? 0 : 10 }}>{children}</div>
  );
}

function SavedRow({ search, onOpen, onForget }: { search: SavedSearch; onOpen: () => void; onForget: () => void }) {
  const [hover, setHover] = useState(false);
  const bits = [
    search.q.trim() || "everything",
    search.category !== ANY_CATEGORY ? search.category : null,
    `${search.radiusKm} km`,
    search.maxPrice != null ? `≤ ₹${search.maxPrice}` : null,
  ].filter(Boolean);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: hover ? "#F6EEDD" : "#fff",
        border: `1.5px solid ${colors.cardBorder}`,
        borderRadius: 12,
        padding: "9px 12px",
      }}
    >
      <div onClick={onOpen} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: colors.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {bits.join(" · ")}
        </div>
        {search.newCount > 0 && (
          <div style={{ fontSize: 11.5, fontWeight: 700, color: colors.clay }}>
            {search.newCount} new since saved
          </div>
        )}
      </div>
      <div
        onClick={onForget}
        role="button"
        aria-label="Remove saved search"
        style={{ flex: "none", color: colors.textFaint, fontSize: 14, fontWeight: 800, cursor: "pointer", padding: "0 2px" }}
      >
        ×
      </div>
    </div>
  );
}

function MiniButton({ label, onClick }: { label: string; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? colors.marigold : "#fff",
        border: `1.5px solid ${hover ? colors.marigold : colors.sand}`,
        borderRadius: 999,
        padding: "7px 14px",
        fontSize: 12.5,
        fontWeight: 700,
        color: colors.ink,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  );
}
