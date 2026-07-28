"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { colors } from "@/lib/colors";
import { useEffect } from "react";
import { sellCategories } from "@/lib/data";
import { useProfile, useUserLocation, useComparablePrices, useMatchingSavedSearchCount } from "@/lib/queries";
import { geocode, type LatLng } from "@/lib/geo";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import Stripe from "@/components/Stripe";
import Chip from "@/components/Chip";
import Button from "@/components/Button";
import LocationChip from "@/components/LocationChip";
import { validateImage, compressImage } from "@/lib/image";

// sellCategories has "Everything else"; the DB category is "Everything".
function normalizeCategory(cat: string): string {
  return cat === "Everything else" ? "Everything" : cat;
}

export default function SellPage() {
  const router = useRouter();
  const [sellTitle, setSellTitle] = useState("Yamaha F310 acoustic guitar");
  const [sellPrice, setSellPrice] = useState("3,200");
  const [sellCat, setSellCat] = useState("Music");
  const [sellNote, setSellNote] = useState("This guitar got me through 3 years of hostel life. Selling because I finally upgraded — it deserves someone who'll actually play it.");
  
  // Restoring the draft has to happen after mount, not in a lazy useState initialiser:
  // sessionStorage doesn't exist during the server render, so seeding the fields up
  // front would make the first client paint differ from the server's and trip
  // hydration. One deliberate cascade, on mount only.
  useEffect(() => {
    const saved = sessionStorage.getItem("bechde_sell_draft");
    if (!saved) return;
    try {
      const d = JSON.parse(saved);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (d.sellTitle) setSellTitle(d.sellTitle);
      if (d.sellPrice) setSellPrice(d.sellPrice);
      if (d.sellCat) setSellCat(d.sellCat);
      if (d.sellNote) setSellNote(d.sellNote);
    } catch {
      // A corrupt draft just means we keep the defaults.
    }
  }, []);

  const saveDraft = (key: string, val: string) => {
    try {
      const saved = sessionStorage.getItem("bechde_sell_draft");
      const d = saved ? JSON.parse(saved) : {};
      d[key] = val;
      sessionStorage.setItem("bechde_sell_draft", JSON.stringify(d));
    } catch {
      // A full or unavailable sessionStorage just means the draft isn't kept.
    }
  };
  const profile = useProfile().data;
  const origin = useUserLocation();

  // Where the item is. Defaults to the seller's own place; typing anything else gets
  // geocoded through Nominatim on submit.
  const [place, setPlace] = useState("");
  const placeValue = place || profile?.neighbourhood || "";
  const [isPublicSpot, setIsPublicSpot] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadingState, setUploadingState] = useState<string | null>(null);
  const uploading = uploadingState !== null;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newId, setNewId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const noteTrim = sellNote.length > 70 ? sellNote.slice(0, 70) + "…" : sellNote;
  const sellPingWord = (sellTitle.split(" ").pop() || "item").toLowerCase();
  const cover = photos[0];

  // Both of these used to be invented ("~40 people nearby", "₹2,800–3,500"). They're
  // now real, and each hides itself when there isn't enough data to say anything.
  const priceGuide = useComparablePrices(normalizeCategory(sellCat)).data;
  const watching = useMatchingSavedSearchCount(sellTitle, normalizeCategory(sellCat)).data ?? 0;
  const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  const onFiles = async (files: FileList | null) => {
    if (!files || !files.length || !profile) return;
    
    const toUpload = Array.from(files).slice(0, 6 - photos.length);
    for (const file of toUpload) {
      const err = validateImage(file);
      if (err) {
        setError(err);
        return;
      }
    }

    setUploadingState(`Uploading 1 of ${toUpload.length}…`);
    setError(null);
    const sb = getSupabaseBrowser();
    const uploaded: string[] = [];
    try {
      for (let i = 0; i < toUpload.length; i++) {
        const file = toUpload[i];
        if (i > 0) setUploadingState(`Uploading ${i + 1} of ${toUpload.length}…`);
        
        const { blob, ext } = await compressImage(file);
        const path = `${profile.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await sb.storage.from("listing-images").upload(path, blob, { contentType: blob.type });
        if (upErr) throw upErr;
        uploaded.push(sb.storage.from("listing-images").getPublicUrl(path).data.publicUrl);
      }
      setPhotos((p) => [...p, ...uploaded]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingState(null);
    }
  };

  const submit = async () => {
    if (submitting || uploading) return;
    if (!profile) {
      setError("Still loading your profile — try again in a moment.");
      return;
    }
    if (!sellTitle.trim()) {
      setError("Give your listing a name first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const sb = getSupabaseBrowser();
    const price = sellPrice.trim().startsWith("₹") ? sellPrice.trim() : `₹${sellPrice.trim()}`;
    const label = sellTitle.trim().split(" ").slice(-2).join(" ").toLowerCase();

    // Resolve the pickup place to coordinates: the seller's own spot unless they typed
    // a different neighbourhood, in which case geocode it (falling back to their spot).
    let point: LatLng = { lat: origin.lat, lng: origin.lng };
    let placeLabel = placeValue.trim() || profile.neighbourhood || origin.label.replace(/^you · /, "");
    const typedElsewhere = placeValue.trim() && placeValue.trim() !== (profile.neighbourhood ?? "");
    if (typedElsewhere) {
      try {
        const hit = await geocode(placeValue.trim());
        if (hit) {
          point = { lat: hit.lat, lng: hit.lng };
          placeLabel = hit.label || placeLabel;
        }
      } catch {
        // Geocoding is best-effort — keep the seller's own coordinates.
      }
    }

    const { data, error: insErr } = await sb
      .from("listings")
      .insert({
        seller_id: profile.id,
        name: sellTitle.trim(),
        label,
        price,
        category: normalizeCategory(sellCat),
        note: sellNote.trim(),
        negotiable: true,
        neighbourhood: placeLabel,
        pickup: placeLabel ? `Pickup near ${placeLabel}` : "Pickup nearby",
        // No km/dist here: distance is derived at read time from the viewer's own
        // position (rowToItem), so storing the seller's copy would be a lie for everyone else.
        lat: point.lat,
        lng: point.lng,
        public_spot: isPublicSpot,
        angle: "45deg",
        listed_ago: "listed just now",
        status: "active",
        story: [{ dot: "#E86A4F", title: "Listed on Bech De", when: "just now", text: sellNote.trim() || "Just listed — ask me anything." }],
        facts: [
          { k: "Condition", v: "As described" },
          { k: "Reason", v: "Making space" },
        ],
      })
      .select("id")
      .single();

    if (insErr || !data) {
      setSubmitting(false);
      setError(insErr?.message ?? "Could not create the listing.");
      return;
    }

    if (photos.length) {
      const rows = photos.map((url, i) => ({ listing_id: data.id, url, sort: i }));
      const { error: imgErr } = await sb.from("listing_images").insert(rows);
      if (imgErr) {
        setSubmitting(false);
        setError(imgErr.message);
        return;
      }
    }

    setSubmitting(false);
    setNewId(data.id);
  };

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", width: "100%", position: "relative" }}>
      {newId && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(251,246,237,.94)", zIndex: 10, display: "grid", placeItems: "center" }}>
          <div style={{ textAlign: "center", animation: "bd-pop .3s ease-out", display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
            <div style={{ width: 92, height: 92, borderRadius: "50%", background: colors.pine, display: "grid", placeItems: "center", fontSize: 42, transform: "rotate(-6deg)" }}>
              🎉
            </div>
            <div style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 34, letterSpacing: "-1px" }}>Bech diya!</div>
            <div style={{ fontSize: 15, color: colors.textBody, maxWidth: 340, lineHeight: 1.6 }}>
              Your {sellPingWord} is live.{" "}
              {watching > 0 ? (
                <>
                  It matches a saved search for <b>{watching} {watching === 1 ? "person" : "people"}</b> nearby.
                </>
              ) : (
                <>It&apos;ll show up for anyone browsing your neighbourhood.</>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <Button onClick={() => router.push(`/product/${newId}`)} style={{ padding: "13px 26px", fontSize: 14.5 }}>
                View listing →
              </Button>
              <Button href="/home" variant="secondary" style={{ padding: "11px 24px", fontSize: 14.5 }}>
                Back home
              </Button>
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="bd-sell-grid" style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: 34, padding: "34px 36px 44px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <h1 className="bd-sell-h1" style={{ margin: 0, fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 36, letterSpacing: "-1px" }}>What are you letting go? 👋</h1>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <PhotoDropzone onClick={() => fileRef.current?.click()} uploadingState={uploadingState} />
            {photos.map((url, i) => (
              <Stripe key={url} src={url} style={{ width: 120, height: 170, borderRadius: 16 }}>
                {i === 0 && (
                  <div style={{ position: "absolute", top: 8, left: 8, background: colors.ink, color: colors.bg, fontSize: 10, fontWeight: 800, borderRadius: 6, padding: "2px 7px" }}>
                    cover
                  </div>
                )}
              </Stripe>
            ))}
            {photos.length === 0 && (
              <Stripe angle="45deg" band={8} label="photo 1" style={{ width: 120, height: 170, borderRadius: 16, fontSize: 10 }}>
                <div style={{ position: "absolute", top: 8, left: 8, background: colors.ink, color: colors.bg, fontSize: 10, fontWeight: 800, borderRadius: 6, padding: "2px 7px" }}>
                  cover
                </div>
              </Stripe>
            )}
          </div>

          <div>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>Give it a name</div>
            <input
              aria-label="Listing name"
              value={sellTitle}
              onChange={(e) => { setSellTitle(e.target.value); saveDraft("sellTitle", e.target.value); }}
              style={{
                width: "100%",
                background: "#fff",
                border: `1.5px solid ${colors.sand}`,
                borderRadius: 14,
                padding: "14px 18px",
                fontSize: 15.5,
                fontWeight: 600,
                color: colors.ink,
                outline: "none",
              }}
            />
          </div>

          <div>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>Where does it belong?</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
              {sellCategories.map((c) => (
                <Chip key={c.name} icon={c.icon} name={c.name} active={sellCat === c.name} onClick={() => { setSellCat(c.name); saveDraft("sellCat", c.name); }} />
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>
              Where can buyers pick it up? <span style={{ color: colors.textFaint, fontWeight: 600 }}>(neighbourhood only — never your exact address)</span>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <input
                aria-label="Pickup neighbourhood"
                value={placeValue}
                onChange={(e) => setPlace(e.target.value)}
                placeholder="e.g. Koramangala, Bengaluru"
                style={{
                  flex: 1,
                  minWidth: 220,
                  background: "#fff",
                  border: `1.5px solid ${colors.sand}`,
                  borderRadius: 14,
                  padding: "14px 18px",
                  fontSize: 15.5,
                  fontWeight: 600,
                  color: colors.ink,
                  outline: "none",
                }}
              />
              <LocationChip />
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
                <input type="checkbox" id="public_spot" checked={isPublicSpot} onChange={e => setIsPublicSpot(e.target.checked)} style={{ width: 16, height: 16, accentColor: colors.terracotta }} />
                <label htmlFor="public_spot" style={{ fontSize: 13, color: colors.textBody, fontWeight: 600 }}>Meeting at a public spot</label>
            </div>
            <div style={{ fontSize: 12, color: colors.textFaint, fontWeight: 600, marginTop: 4 }}>We recommend you to choose a nearby public spot for privacy.</div>
          </div>

          <div>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>Your price</div>
            <div className="bd-sell-price-row" style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <input
                className="bd-sell-price-input"
                aria-label="Price in rupees"
                value={sellPrice}
                onChange={(e) => { setSellPrice(e.target.value); saveDraft("sellPrice", e.target.value); }}
                style={{
                  background: "#fff",
                  border: `1.5px solid ${colors.sand}`,
                  borderRadius: 14,
                  padding: "14px 18px",
                  fontFamily: "var(--font-bricolage)",
                  fontWeight: 800,
                  fontSize: 22,
                  color: colors.clay,
                  width: 150,
                  outline: "none",
                }}
              />
              {priceGuide && (
                <div style={{ background: colors.sage, borderRadius: 12, padding: "10px 16px", fontSize: 13, color: colors.pine, fontWeight: 600, lineHeight: 1.45 }}>
                  💡 {priceGuide.count} similar {sellCat.toLowerCase()} listings near you are priced{" "}
                  <b>
                    {inr(priceGuide.low)}–{inr(priceGuide.high)}
                  </b>
                  .
                </div>
              )}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>
              Tell its story <span style={{ color: colors.textFaint, fontWeight: 600 }}>(listings with a story sell 2× faster)</span>
            </div>
            <textarea
              aria-label="Tell its story"
              value={sellNote}
              onChange={(e) => { setSellNote(e.target.value); saveDraft("sellNote", e.target.value); }}
              rows={3}
              style={{
                width: "100%",
                background: "#fff",
                border: `1.5px solid ${colors.sand}`,
                borderRadius: 14,
                padding: "16px 18px",
                fontSize: 14.5,
                lineHeight: 1.6,
                color: colors.textDark,
                fontStyle: "italic",
                outline: "none",
                resize: "vertical",
              }}
            />
          </div>

          {error && <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.terracotta }}>{error}</div>}

          {/* submit() already refuses while a photo is in flight — say so, rather than
              letting the click land on nothing. */}
          <Button
            onClick={submit}
            rotate={-1.5}
            disabled={submitting || uploading}
            style={{ alignSelf: "flex-start", padding: "15px 34px", fontSize: 16, opacity: submitting || uploading ? 0.7 : 1 }}
          >
            {submitting ? "Posting…" : uploading ? "Waiting for the photo…" : "Bech de! →"}
          </Button>

          <div style={{ fontSize: 12, color: colors.textFaint, fontWeight: 600, lineHeight: 1.6 }}>
            By listing you confirm it&apos;s yours to sell and isn&apos;t on the{" "}
            <Link href="/legal/prohibited" style={{ color: colors.clay, fontWeight: 700 }}>
              prohibited items list
            </Link>
            . Listings that break the{" "}
            <Link href="/legal/terms" style={{ color: colors.clay, fontWeight: 700 }}>
              rules
            </Link>{" "}
            get taken down.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: colors.textFaint, textTransform: "uppercase", letterSpacing: "1px" }}>
            Live preview · how buyers see it
          </div>
          <div
            style={{
              background: "#fff",
              border: `1.5px solid ${colors.cardBorder}`,
              borderRadius: 20,
              overflow: "hidden",
              boxShadow: "0 14px 30px rgba(60,45,20,.1)",
              transform: "rotate(1.2deg)",
            }}
          >
            <Stripe angle="45deg" src={cover} band={9} label="cover photo" style={{ height: 190, fontSize: 11 }}>
              <div
                style={{
                  position: "absolute",
                  top: 12,
                  left: 12,
                  background: colors.ink,
                  color: colors.bg,
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 999,
                  padding: "3px 10px",
                  whiteSpace: "nowrap",
                }}
              >
                📍 {placeValue.trim() || "your neighbourhood"}
              </div>
            </Stripe>
            <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 7 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{sellTitle}</div>
                <div style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 18, color: colors.clay, whiteSpace: "nowrap" }}>₹{sellPrice}</div>
              </div>
              <div style={{ fontSize: 12.5, fontStyle: "italic", color: colors.textMuted, lineHeight: 1.5 }}>&ldquo;{noteTrim}&rdquo;</div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: colors.textBody, fontWeight: 600 }}>
                <span style={{ width: 20, height: 20, borderRadius: "50%", background: colors.teal, flex: "none" }} />
                {profile?.name ?? "Someone"} · new seller ✨
              </div>
            </div>
          </div>
          <div style={{ background: colors.offerBg, borderRadius: 14, padding: "14px 18px", fontSize: 13, color: "#6B5320", lineHeight: 1.55, marginTop: 8 }}>
            {watching > 0 ? (
              <>
                🔔 <b>{watching} {watching === 1 ? "person has" : "people have"}</b> a saved search this would match.
              </>
            ) : (
              <>🔍 Nobody has a saved search for this yet — it&apos;ll still show up for anyone browsing nearby.</>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PhotoDropzone({ onClick, uploadingState }: { onClick: () => void; uploadingState: string | null }) {
  const [hover, setHover] = useState(false);
  const uploading = uploadingState !== null;
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 1,
        minWidth: 200,
        height: 170,
        border: `2.5px dashed ${hover ? colors.terracotta : "#E0B45C"}`,
        borderRadius: 20,
        background: hover ? colors.offerBg : "#FDF4DE",
        display: "grid",
        placeItems: "center",
        textAlign: "center",
        cursor: "pointer",
      }}
    >
      <div>
        <div style={{ fontSize: 26, marginBottom: 6 }}>{uploading ? "⏳" : "📸"}</div>
        <div style={{ fontWeight: 800, fontSize: 15 }}>{uploadingState ?? "Add photos"}</div>
        <div style={{ fontSize: 12.5, color: colors.textFaint, fontWeight: 600 }}>up to 6 · first one becomes the cover</div>
      </div>
    </div>
  );
}
