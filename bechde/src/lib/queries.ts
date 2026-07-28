"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { USER_LOCATION, type Item, type ChatThread } from "@/lib/data";
import { haversineKm, formatKm, reverseGeocode, type LatLng } from "@/lib/geo";
import { listedAgo } from "@/lib/time";
import { ANY_CATEGORY, matchesFilters, type Filters } from "@/lib/search";

// ---------------------------------------------------------------------------
// Row → Item mapping (DB snake_case + joined seller → the Item shape screens use)
// ---------------------------------------------------------------------------
interface ProfileRow {
  id: string;
  name: string;
  initial: string | null;
  color: string | null;
  rating_avg: number | null;
  rating_count: number;
  sold: number;
  reply_time: string | null;
}

/** "★ 4.8 (12)" once someone's been reviewed, "new seller" before that. */
export function formatRating(avg: number | null | undefined, count: number | undefined): string {
  if (!avg || !count) return "new seller";
  return `★ ${Number(avg).toFixed(1)} (${count})`;
}

interface ListingRow {
  id: string;
  created_at: string;
  status: string;
  label: string | null;
  name: string;
  price: string;
  category: Item["category"];
  angle: string | null;
  note: string | null;
  negotiable: boolean;
  listed_ago: string | null;
  neighbourhood: string | null;
  pickup: string | null;
  lat: number | null;
  lng: number | null;
  public_spot: boolean | null;
  story: Item["story"];
  facts: Item["facts"];
  seller: ProfileRow | null;
  listing_images: { url: string; sort: number }[] | null;
}

const LISTING_SELECT =
  "*, seller:profiles!listings_seller_id_fkey(*), listing_images(url,sort)";

export function rowToItem(r: ListingRow): Item {
  const s = r.seller;
  const images = (r.listing_images ?? [])
    .slice()
    .sort((a, b) => a.sort - b.sort)
    .map((im) => im.url);
  return {
    cover: images[0],
    images,
    createdAt: r.created_at,
    status: r.status,
    id: r.id,
    label: r.label ?? "",
    name: r.name,
    price: r.price,
    km: 0,
    dist: "",
    category: r.category,
    angle: r.angle ?? "0deg",
    note: r.note ?? "",
    negotiable: r.negotiable,
    // Derived from created_at, so a listing doesn't read "listed just now" forever.
    listedAgo: r.status === "sold" ? (r.listed_ago ?? "") : listedAgo(r.created_at, r.listed_ago ?? ""),
    neighbourhood: r.neighbourhood ?? "",
    seller: {
      id: s?.id,
      name: s?.name ?? "Someone",
      initial: s?.initial ?? "?",
      color: s?.color ?? "#3E9B8F",
      rating: formatRating(s?.rating_avg, s?.rating_count),
      ratingAvg: s?.rating_avg ?? null,
      ratingCount: s?.rating_count ?? 0,
      sold: s?.sold ?? 0,
      replyTime: s?.reply_time ?? "—",
    },
    story: r.story ?? [],
    facts: r.facts ?? [],
    pickup: r.pickup ?? "",
    lat: r.lat ?? 0,
    lng: r.lng ?? 0,
    publicSpot: r.public_spot ?? false,
  };
}

// ---------------------------------------------------------------------------
// Generic async-state helper
// ---------------------------------------------------------------------------
interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetch-on-deps-change. The result is stamped with the deps it belongs to, so a deps
 * change invalidates it during render — no synchronous setState inside the effect,
 * which would cascade renders. All call sites pass primitive deps.
 */
function useAsync<T>(run: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const key = JSON.stringify(deps);
  const [state, setState] = useState<{ key: string | null; data: T | null; error: string | null }>({
    key: null,
    data: null,
    error: null,
  });

  useEffect(() => {
    let alive = true;
    run()
      .then((data) => alive && setState({ key, data, error: null }))
      .catch((e) => alive && setState({ key, data: null, error: String(e?.message ?? e) }));
    return () => {
      alive = false;
    };
    // `run` is a fresh closure every render; `deps` (via key) is the contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const fresh = state.key === key;
  return {
    data: fresh ? state.data : null,
    loading: !fresh,
    error: fresh ? state.error : null,
  };
}

// ---------------------------------------------------------------------------
// Distance — computed from the viewer's location at read time (Phase 4), so the
// stored listings.km / listings.dist are only a fallback for coordinate-less rows.
// ---------------------------------------------------------------------------
export function withDistance(item: Item, origin?: LatLng): Item {
  if (!origin) return item;
  if (typeof item.lat !== "number" || typeof item.lng !== "number") return item;
  const km = haversineKm(origin, { lat: item.lat, lng: item.lng });
  return { ...item, km, dist: formatKm(km) };
}

function useDistances(state: AsyncState<Item[]>): AsyncState<Item[]> {
  const origin = useUserLocation();
  const { lat, lng } = origin;
  return useMemo(
    () => ({ ...state, data: state.data ? state.data.map((i) => withDistance(i, { lat, lng })) : null }),
    [state, lat, lng]
  );
}

// ---------------------------------------------------------------------------
// Listing hooks — mirror the export names in data.ts
// ---------------------------------------------------------------------------
export function useItems() {
  return useDistances(
    useAsync<Item[]>(async () => {
      const { data, error } = await getSupabaseBrowser()
        .from("listings")
        .select(LISTING_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as ListingRow[]).map(rowToItem);
    }, [])
  );
}

export function useItem(id: string) {
  const origin = useUserLocation();
  const state = useAsync<Item | null>(async () => {
    const { data, error } = await getSupabaseBrowser()
      .from("listings")
      .select(LISTING_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToItem(data as ListingRow) : null;
  }, [id]);
  const { lat, lng } = origin;
  return useMemo(
    () => ({ ...state, data: state.data ? withDistance(state.data, { lat, lng }) : null }),
    [state, lat, lng]
  );
}

export function useFeedItems() {
  return useDistances(
    useAsync<Item[]>(async () => {
      // Most-recent active listings so a freshly-created one shows at the top.
      const { data, error } = await getSupabaseBrowser()
        .from("listings")
        .select(LISTING_SELECT)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data as ListingRow[]).map(rowToItem);
    }, [])
  );
}

/** Everything the signed-in person has listed, newest first (active *and* sold). */
export function useMyListings() {
  const me = useProfile().data;
  const myProfileId = me?.id ?? null;
  return useDistances(
    useAsync<Item[]>(async () => {
      if (!myProfileId) return [];
      const { data, error } = await getSupabaseBrowser()
        .from("listings")
        .select(LISTING_SELECT)
        .eq("seller_id", myProfileId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as ListingRow[]).map(rowToItem);
    }, [myProfileId])
  );
}

/**
 * Every active listing that has coordinates, annotated with its real distance from
 * the viewer and sorted nearest-first. Home (radar + feed + count) and the map both
 * derive their views from this one query.
 */
export function useNearbyItems() {
  const state = useDistances(
    useAsync<Item[]>(async () => {
      // Cap at 200: distance is computed at read time from the viewer's position,
      // so we can't sort by it in the DB — just limit to prevent runaway queries.
      const { data, error } = await getSupabaseBrowser()
        .from("listings")
        .select(LISTING_SELECT)
        .eq("status", "active")
        .not("lat", "is", null)
        .not("lng", "is", null)
        .limit(200);
      if (error) throw error;
      return (data as ListingRow[]).map(rowToItem);
    }, [])
  );
  return useMemo(
    () => ({ ...state, data: state.data ? [...state.data].sort((a, b) => a.km - b.km) : null }),
    [state]
  );
}

export const useMapItems = useNearbyItems;

// ---------------------------------------------------------------------------
// Search — ranked via the search_listings() RPC, then filtered by real distance
// ---------------------------------------------------------------------------
/** Applies the SQL-side parts of a filter set to a search_listings() call. */
function applyFilters<T extends { eq: (c: string, v: string) => T; gte: (c: string, v: number) => T; lte: (c: string, v: number) => T }>(
  builder: T,
  f: Filters
): T {
  let q = builder;
  if (f.category && f.category !== ANY_CATEGORY) q = q.eq("category", f.category);
  if (f.minPrice != null) q = q.gte("price_num", f.minPrice);
  if (f.maxPrice != null) q = q.lte("price_num", f.maxPrice);
  return q;
}

/** How many rows to fetch from the DB per page. We over-fetch because radius
 *  filtering happens client-side and may discard some — fetching 60 to show up
 *  to ~20 visible results avoids a page that looks short. */
const SEARCH_DB_PAGE = 60;
/** How many visible results to show per page after radius filtering. */
const SEARCH_PAGE = 20;

export function useSearchResults(filters: Filters) {
  const { q, category, minPrice, maxPrice } = filters;
  // Pagination is keyed by the filters it belongs to, the same trick useAsync uses:
  // a page set carries the key it was fetched under, so a filter change makes the old
  // pages simply not apply. Cheaper and safer than resetting state during render.
  const filterKey = JSON.stringify([q, category, minPrice, maxPrice]);
  const [paged, setPaged] = useState<{ key: string; pages: Item[][]; offset: number; done: boolean }>(
    { key: filterKey, pages: [], offset: 0, done: false }
  );
  const current = paged.key === filterKey ? paged : { key: filterKey, pages: [], offset: 0, done: false };
  const pages = current.pages;
  const dbOffset = current.offset;
  const dbDone = current.done;

  // Both writers stamp the current filterKey, so a result that arrives after the
  // filters changed lands on its own key and is ignored rather than mixed in.
  const markFirstPage = useCallback(
    (done: boolean) => setPaged({ key: filterKey, pages: [], offset: SEARCH_DB_PAGE, done }),
    [filterKey]
  );
  const appendPage = useCallback(
    (rows: Item[], done: boolean) =>
      setPaged((p) => {
        const base = p.key === filterKey ? p : { key: filterKey, pages: [], offset: 0, done: false };
        return { key: filterKey, pages: [...base.pages, rows], offset: base.offset + SEARCH_DB_PAGE, done };
      }),
    [filterKey]
  );

  const firstPage = useDistances(
    useAsync<Item[]>(async () => {
      // Text ranking + category/price happen in Postgres; radius needs the viewer's
      // location, so it's applied below once distances are annotated.
      const query = getSupabaseBrowser()
        .rpc("search_listings", { q })
        .select(LISTING_SELECT)
        .range(0, SEARCH_DB_PAGE - 1);
      const { data, error } = await applyFilters(query, filters);
      if (error) throw error;
      const rows = (data as unknown as ListingRow[]).map(rowToItem);
      markFirstPage(rows.length < SEARCH_DB_PAGE);
      return rows;
    }, [q, category, minPrice, maxPrice])
  );

  const { radiusKm } = filters;

  // Apply radius + filter on the first page and any appended pages.
  const allFiltered = useMemo(() => {
    const f: Filters = { q, category, radiusKm, minPrice, maxPrice };
    const base = firstPage.data ? firstPage.data.filter((i) => matchesFilters(i, f)) : [];
    const extra = pages.flat().filter((i) => matchesFilters(i, f));
    return [...base, ...extra];
  }, [firstPage.data, pages, q, category, radiusKm, minPrice, maxPrice]);

  const hasMore = !dbDone;

  const loadMore = useCallback(async () => {
    if (dbDone) return;
    const query = getSupabaseBrowser()
      .rpc("search_listings", { q })
      .select(LISTING_SELECT)
      .range(dbOffset, dbOffset + SEARCH_DB_PAGE - 1);
    const { data, error } = await applyFilters(query, { q, category, radiusKm, minPrice, maxPrice });
    if (error) return;
    const rows = (data as unknown as ListingRow[]).map(rowToItem);
    appendPage(rows, rows.length < SEARCH_DB_PAGE);
  }, [dbOffset, dbDone, q, category, radiusKm, minPrice, maxPrice, appendPage]);

  return {
    data: allFiltered,
    loading: firstPage.loading,
    error: firstPage.error,
    hasMore,
    loadMore,
    /** How many visible results are shown so far. */
    total: allFiltered.length,
    pageSize: SEARCH_PAGE,
  };
}

// ---------------------------------------------------------------------------
// Saved searches
// ---------------------------------------------------------------------------
export interface SavedSearch extends Filters {
  id: string;
  createdAt: string;
  /** matching listings created since this search was saved */
  newCount: number;
}

const SAVED_SEARCH_LIMIT = 6;

export function useSavedSearches() {
  const me = useProfile().data;
  const myProfileId = me?.id ?? null;
  const origin = useUserLocation();
  const { lat, lng } = origin;
  const [version, setVersion] = useState(0);

  const state = useAsync<SavedSearch[]>(async () => {
    if (!myProfileId) return [];
    const sb = getSupabaseBrowser();
    const { data, error } = await sb
      .from("saved_searches")
      .select("id,q,category,radius_km,min_price,max_price,created_at")
      .order("created_at", { ascending: false })
      .limit(SAVED_SEARCH_LIMIT);
    if (error) throw error;

    return Promise.all(
      (data ?? []).map(async (row) => {
        const f: Filters = {
          q: row.q ?? "",
          category: row.category ?? ANY_CATEGORY,
          radiusKm: row.radius_km ?? 3,
          minPrice: row.min_price,
          maxPrice: row.max_price,
        };
        // Count matches that appeared after saving. Coordinates come back too, so the
        // saved radius is honoured — the badge means the same thing as the results.
        const q = sb
          .rpc("search_listings", { q: f.q })
          .select("id,lat,lng,created_at")
          .gt("created_at", row.created_at);
        const { data: hits } = await applyFilters(q, f);
        const newCount = ((hits ?? []) as { lat: number | null; lng: number | null }[]).filter(
          (h) => h.lat != null && h.lng != null && haversineKm({ lat, lng }, { lat: h.lat, lng: h.lng }) <= f.radiusKm
        ).length;
        return { ...f, id: row.id as string, createdAt: row.created_at as string, newCount };
      })
    );
  }, [myProfileId, lat, lng, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}

export async function saveSearch(f: Filters) {
  const me = myId();
  const { error } = await getSupabaseBrowser().from("saved_searches").insert({
    user_id: me,
    q: f.q.trim(),
    category: f.category === ANY_CATEGORY ? null : f.category,
    radius_km: f.radiusKm,
    min_price: f.minPrice,
    max_price: f.maxPrice,
  });
  if (error) throw error;
}

export async function deleteSavedSearch(id: string) {
  const { error } = await getSupabaseBrowser().from("saved_searches").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Current signed-in user's profile
// ---------------------------------------------------------------------------
export interface MyProfile {
  id: string;
  name: string;
  initial: string | null;
  email: string | null;
  lat: number | null;
  lng: number | null;
  neighbourhood: string | null;
  bio: string | null;
  created_at: string;
  // derived by trigger — never written by the app
  rating_avg: number | null;
  rating_count: number;
  sold: number;
  reply_time: string | null;
}

const PROFILE_COLS =
  "id,name,initial,email,lat,lng,neighbourhood,bio,created_at,rating_avg,rating_count,sold,reply_time";

// The signed-in profile is read by several screens at once (Header, sell, profile,
// plus every distance calculation) — so it lives in one tiny module store instead of
// one request per hook.
let profileState: AsyncState<MyProfile | null> = { data: null, loading: true, error: null };
let profileStarted = false;
const profileListeners = new Set<() => void>();

function setProfileState(next: AsyncState<MyProfile | null>) {
  profileState = next;
  profileListeners.forEach((l) => l());
}

async function loadProfile() {
  try {
    const sb = getSupabaseBrowser();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) {
      setProfileState({ data: null, loading: false, error: null });
      return;
    }
    const { data, error } = await sb.from("profiles").select(PROFILE_COLS).eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    setProfileState({ data: (data as MyProfile) ?? null, loading: false, error: null });
  } catch (e: unknown) {
    setProfileState({ data: null, loading: false, error: String((e as Error)?.message ?? e) });
  }
}

export function useProfile(): AsyncState<MyProfile | null> {
  const [, bump] = useState(0);
  useEffect(() => {
    const listener = () => bump((v) => v + 1);
    profileListeners.add(listener);
    if (!profileStarted) {
      profileStarted = true;
      loadProfile();
    }
    return () => {
      profileListeners.delete(listener);
    };
  }, []);
  return profileState;
}

export function refreshProfile() {
  profileStarted = true;
  return loadProfile();
}

export async function signOut() {
  await getSupabaseBrowser().auth.signOut();
  profileStarted = false;
  setProfileState({ data: null, loading: true, error: null });
  window.location.href = "/";
}

export interface UserLocation extends LatLng {
  label: string;
  /** true once the person has actually shared their location */
  precise: boolean;
}

const LOCATION_STORAGE_KEY = "bechde_user_location";
const LOCATION_EVENT = "bechde_location_changed";

export function useUserLocation(): UserLocation {
  const profile = useProfile().data;
  const [localLoc, setLocalLoc] = useState<UserLocation | null>(null);

  useEffect(() => {
    const updateFromStorage = () => {
      try {
        const raw = localStorage.getItem(LOCATION_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed.lat === "number" && typeof parsed.lng === "number") {
            setLocalLoc({
              lat: parsed.lat,
              lng: parsed.lng,
              label: parsed.label || "you",
              precise: true,
            });
            return;
          }
        }
      } catch {}
      setLocalLoc(null);
    };

    updateFromStorage();
    window.addEventListener(LOCATION_EVENT, updateFromStorage);
    return () => window.removeEventListener(LOCATION_EVENT, updateFromStorage);
  }, []);

  if (profile && profile.lat != null && profile.lng != null) {
    return {
      lat: profile.lat,
      lng: profile.lng,
      label: profile.neighbourhood ? `you · ${profile.neighbourhood}` : "you",
      precise: true,
    };
  }

  if (localLoc) {
    return localLoc;
  }

  return { ...USER_LOCATION, precise: false };
}

/** Save location for guests and signed-in users alike */
export async function saveUserLocation(point: LatLng & { label?: string }): Promise<string> {
  let label = point.label;
  if (!label) {
    try {
      label = (await reverseGeocode(point))?.label ?? "you";
    } catch {
      label = "you";
    }
  }

  const locObj: UserLocation = {
    lat: point.lat,
    lng: point.lng,
    label: label.replace(/^you · /, ""),
    precise: true,
  };

  try {
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(locObj));
    window.dispatchEvent(new Event(LOCATION_EVENT));
  } catch {}

  const profile = profileState.data;
  if (profile) {
    const sb = getSupabaseBrowser();
    await sb
      .from("profiles")
      .update({ lat: point.lat, lng: point.lng, neighbourhood: locObj.label })
      .eq("id", profile.id);

    setProfileState({
      data: { ...profile, lat: point.lat, lng: point.lng, neighbourhood: locObj.label },
      loading: false,
      error: null,
    });
  }

  return locObj.label;
}

export async function saveMyLocation(point: LatLng): Promise<string> {
  return saveUserLocation(point);
}

// ---------------------------------------------------------------------------
// Chat hook — reconstructs the ChatThread shape from chats + listing + last msg
// ---------------------------------------------------------------------------
interface PartyRow {
  id: string;
  name: string;
  initial: string | null;
  color: string | null;
}

interface ChatRow {
  id: string;
  created_at: string;
  buyer_id: string;
  seller_id: string;
  listing: { name: string; id: string; price: string; listing_images: { url: string; sort: number }[] } | null;
  buyer: PartyRow | null;
  seller: PartyRow | null;
  messages: { body: string; created_at: string }[];
  offers: { amount: string; status: OfferStatus; created_at: string; from_id: string }[];
}

/** A chat list row, plus who's who — the conversation pane needs the participants. */
export interface Thread extends ChatThread {
  buyerId: string;
  sellerId: string;
  price: string;
  otherName: string;
}

// listing_images joined here so the chat page gets cover photos without needing
// the catch-all useItems() that fetches every listing in the database.
const CHAT_SELECT =
  "id, created_at, buyer_id, seller_id, listing:listings(id,name,price,listing_images(url,sort))," +
  " buyer:profiles!chats_buyer_id_fkey(id,name,initial,color)," +
  " seller:profiles!chats_seller_id_fkey(id,name,initial,color)," +
  " messages(body,created_at), offers(amount,status,created_at,from_id)";

const shortTime = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString([], { weekday: "short" });
};

export function useChatThreads() {
  const me = useProfile().data;
  const myId = me?.id ?? null;
  const [, bump] = useState(0);

  useEffect(() => {
    const l = () => bump((v) => v + 1);
    unreadListeners.add(l);
    return () => {
      unreadListeners.delete(l);
    };
  }, []);

  return useAsync<Thread[]>(async () => {
    if (!myId) return [];
    const { data, error } = await getSupabaseBrowser()
      .from("chats")
      .select(CHAT_SELECT)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const angles = ["60deg", "45deg", "30deg", "75deg"];
    return (data as unknown as ChatRow[]).map((c, i) => {
      // Show the *other* person's avatar, whichever side of the deal I'm on.
      const other = c.buyer_id === myId ? c.seller : c.buyer;
      const lastMsg = [...c.messages].sort((a, b) => a.created_at.localeCompare(b.created_at)).at(-1);
      const lastOffer = [...c.offers].sort((a, b) => a.created_at.localeCompare(b.created_at)).at(-1);
      // The preview line is whichever happened last — a message or an offer.
      const offerNewer = lastOffer && (!lastMsg || lastOffer.created_at > lastMsg.created_at);
      const at = offerNewer ? lastOffer!.created_at : lastMsg?.created_at;
      let last = lastMsg?.body ?? "Say hello 👋";
      if (offerNewer) {
        last =
          lastOffer!.status === "accepted"
            ? `Deal at ${lastOffer!.amount} 🤝`
            : lastOffer!.status === "declined"
              ? `Offer declined: ${lastOffer!.amount}`
              : `Offer made: ${lastOffer!.amount}`;
      }
      // Pick the first image (by sort order) as the cover, if we have any.
      const imgs = (c.listing?.listing_images ?? []).slice().sort((a, b) => a.sort - b.sort);
      return {
        id: c.id,
        item: c.listing?.name ?? "Listing",
        itemId: c.listing?.id ?? "",
        price: c.listing?.price ?? "",
        buyerId: c.buyer_id,
        sellerId: c.seller_id,
        otherName: other?.name ?? "Someone",
        last,
        time: at ? shortTime(at) : "",
        initial: other?.initial ?? "?",
        avatar: other?.color ?? "#3E9B8F",
        angle: angles[i % angles.length],
        active: false,
        cover: imgs.length > 0 ? imgs[0].url : undefined,
      };
    });
  }, [myId, unreadVersion]);
}

// ---------------------------------------------------------------------------
// One conversation: messages + offers, live over Supabase Realtime
// ---------------------------------------------------------------------------
export type OfferStatus = "pending" | "accepted" | "declined";

export interface ChatMessage {
  id: string;
  body: string;
  createdAt: string;
  senderId: string;
  mine: boolean;
}

export interface ChatOffer {
  id: string;
  amount: string;
  status: OfferStatus;
  createdAt: string;
  fromId: string;
  mine: boolean;
}

export interface Conversation {
  messages: ChatMessage[];
  offers: ChatOffer[];
  loading: boolean;
  error: string | null;
  /** merge a row we just wrote ourselves (realtime dedupes by id) */
  push: (row: ChatMessage | ChatOffer) => void;
}

/**
 * Live conversation state. Loads the thread's history, then subscribes to inserts on
 * `messages` and inserts/updates on `offers` for this chat so both sides stay in sync
 * without a refresh (the tables are in the `supabase_realtime` publication).
 */
// One state object keyed by chat+viewer, so switching threads simply invalidates it
// instead of needing a synchronous reset inside the effect.
interface ConvoStore {
  key: string | null;
  messages: ChatMessage[];
  offers: ChatOffer[];
  error: string | null;
}
const EMPTY_CONVO: ConvoStore = { key: null, messages: [], offers: [], error: null };

export function useConversation(chatId: string | null): Conversation {
  const me = useProfile().data;
  const myId = me?.id ?? null;
  const key = chatId && myId ? `${chatId}|${myId}` : null;
  const [store, setStore] = useState<ConvoStore>(EMPTY_CONVO);
  const fresh = !!key && store.key === key;

  useEffect(() => {
    if (!key || !chatId || !myId) return;
    const sb = getSupabaseBrowser();
    let alive = true;

    // Only merge updates that still belong to the thread we're looking at.
    const update = (fn: (s: ConvoStore) => ConvoStore) =>
      setStore((prev) => (prev.key === key ? fn(prev) : prev));

    (async () => {
      const [m, o] = await Promise.all([
        sb.from("messages").select("id,body,created_at,sender_id").eq("chat_id", chatId).order("created_at"),
        sb.from("offers").select("id,amount,status,created_at,from_id").eq("chat_id", chatId).order("created_at"),
      ]);
      if (!alive) return;
      if (m.error || o.error) {
        setStore({ ...EMPTY_CONVO, key, error: (m.error ?? o.error)!.message });
        return;
      }
      setStore({
        key,
        error: null,
        messages: (m.data ?? []).map((r) => ({
          id: r.id as string,
          body: r.body as string,
          createdAt: r.created_at as string,
          senderId: r.sender_id as string,
          mine: r.sender_id === myId,
        })),
        offers: (o.data ?? []).map((r) => ({
          id: r.id as string,
          amount: r.amount as string,
          status: r.status as OfferStatus,
          createdAt: r.created_at as string,
          fromId: r.from_id as string,
          mine: r.from_id === myId,
        })),
      });
    })();

    const channel = sb
      .channel(`chat:${chatId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const r = payload.new as { id: string; body: string; created_at: string; sender_id: string };
          update((s) =>
            s.messages.some((x) => x.id === r.id)
              ? s
              : {
                  ...s,
                  messages: [
                    ...s.messages,
                    { id: r.id, body: r.body, createdAt: r.created_at, senderId: r.sender_id, mine: r.sender_id === myId },
                  ],
                }
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "offers", filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const r = payload.new as { id: string; amount: string; status: OfferStatus; created_at: string; from_id: string };
          if (!r?.id) return;
          const next: ChatOffer = {
            id: r.id,
            amount: r.amount,
            status: r.status,
            createdAt: r.created_at,
            fromId: r.from_id,
            mine: r.from_id === myId,
          };
          update((s) => ({
            ...s,
            offers: s.offers.some((x) => x.id === r.id)
              ? s.offers.map((x) => (x.id === r.id ? next : x))
              : [...s.offers, next],
          }));
        }
      )
      .subscribe();

    return () => {
      alive = false;
      sb.removeChannel(channel);
    };
  }, [key, chatId, myId]);

  const push = useCallback((row: ChatMessage | ChatOffer) => {
    setStore((s) => {
      if ("body" in row) {
        return s.messages.some((x) => x.id === row.id) ? s : { ...s, messages: [...s.messages, row] };
      }
      return {
        ...s,
        offers: s.offers.some((x) => x.id === row.id) ? s.offers.map((x) => (x.id === row.id ? row : x)) : [...s.offers, row],
      };
    });
  }, []);

  return {
    messages: fresh ? store.messages : [],
    offers: fresh ? store.offers : [],
    loading: !!key && !fresh,
    error: fresh ? store.error : null,
    push,
  };
}

/**
 * Open (or reuse) the buyer's thread for a listing. One thread per buyer↔listing, which
 * is what the `chats_insert` policy allows: buyer_id must be the caller.
 */
export async function startChat(listingId: string, sellerId: string): Promise<string> {
  const me = myId();
  const sb = getSupabaseBrowser();
  const { data: existing, error: findErr } = await sb
    .from("chats")
    .select("id")
    .eq("listing_id", listingId)
    .eq("buyer_id", me)
    .maybeSingle();
  if (findErr) throw findErr;
  if (existing) return existing.id as string;
  const { data, error } = await sb
    .from("chats")
    .insert({ listing_id: listingId, buyer_id: me, seller_id: sellerId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

function myId(): string {
  const me = profileState.data;
  if (!me) throw new Error("Sign in first.");
  return me.id;
}

export async function sendMessage(chatId: string, body: string): Promise<ChatMessage> {
  const me = myId();
  const { data, error } = await getSupabaseBrowser()
    .from("messages")
    .insert({ chat_id: chatId, sender_id: me, body })
    .select("id,body,created_at,sender_id")
    .single();
  if (error) throw error;
  return { id: data.id, body: data.body, createdAt: data.created_at, senderId: data.sender_id, mine: true };
}

export async function makeOffer(chatId: string, listingId: string, amount: string): Promise<ChatOffer> {
  const me = myId();
  const { data, error } = await getSupabaseBrowser()
    .from("offers")
    .insert({ chat_id: chatId, listing_id: listingId, from_id: me, amount })
    .select("id,amount,status,created_at,from_id")
    .single();
  if (error) throw error;
  return { id: data.id, amount: data.amount, status: data.status, createdAt: data.created_at, fromId: data.from_id, mine: true };
}

export async function setOfferStatus(
  offerId: string,
  status: Exclude<OfferStatus, "pending">
): Promise<ChatOffer> {
  const me = profileState.data?.id ?? null;
  const { data, error } = await getSupabaseBrowser()
    .from("offers")
    .update({ status })
    .eq("id", offerId)
    .select("id,amount,status,created_at,from_id")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    amount: data.amount,
    status: data.status,
    createdAt: data.created_at,
    fromId: data.from_id,
    mine: data.from_id === me,
  };
}

// ---------------------------------------------------------------------------
// Reputation — reviews left after an accepted deal. Every aggregate on a profile
// (rating, sold count, reply time) is maintained by triggers from rows like these;
// nothing here writes them directly.
// ---------------------------------------------------------------------------
export interface Review {
  id: string;
  rating: number;
  body: string | null;
  createdAt: string;
  listingName: string;
  reviewer: { name: string; initial: string | null; color: string | null };
}

const REVIEW_SELECT =
  "id,rating,body,created_at,listing:listings(name),reviewer:profiles!reviews_reviewer_id_fkey(name,initial,color)";

interface ReviewRow {
  id: string;
  rating: number;
  body: string | null;
  created_at: string;
  listing: { name: string } | null;
  reviewer: { name: string; initial: string | null; color: string | null } | null;
}

/** Reviews a person has received, newest first. Publicly readable. */
export function useReviews(profileId: string | null | undefined) {
  return useAsync<Review[]>(async () => {
    if (!profileId) return [];
    const { data, error } = await getSupabaseBrowser()
      .from("reviews")
      .select(REVIEW_SELECT)
      .eq("subject_id", profileId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as unknown as ReviewRow[]).map((r) => ({
      id: r.id,
      rating: r.rating,
      body: r.body,
      createdAt: r.created_at,
      listingName: r.listing?.name ?? "a listing",
      reviewer: {
        name: r.reviewer?.name ?? "Someone",
        initial: r.reviewer?.initial ?? "?",
        color: r.reviewer?.color ?? "#3E9B8F",
      },
    }));
  }, [profileId ?? null]);
}

export interface WrittenReview {
  id: string;
  rating: number;
  body: string | null;
  createdAt: string;
  listingName: string;
  subject: { name: string; initial: string | null; color: string | null };
}

const WRITTEN_REVIEW_SELECT =
  "id,rating,body,created_at,listing:listings(name),subject:profiles!reviews_subject_id_fkey(name,initial,color)";

interface WrittenReviewRow extends Omit<ReviewRow, "reviewer"> {
  subject: { name: string; initial: string | null; color: string | null } | null;
}

export function useWrittenReviews(profileId: string | null | undefined) {
  return useAsync<WrittenReview[]>(async () => {
    if (!profileId) return [];
    const { data, error } = await getSupabaseBrowser()
      .from("reviews")
      .select(WRITTEN_REVIEW_SELECT)
      .eq("reviewer_id", profileId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as unknown as WrittenReviewRow[]).map((r) => ({
      id: r.id,
      rating: r.rating,
      body: r.body,
      createdAt: r.created_at,
      listingName: r.listing?.name ?? "a listing",
      subject: {
        name: r.subject?.name ?? "Someone",
        initial: r.subject?.initial ?? "?",
        color: r.subject?.color ?? "#3E9B8F",
      },
    }));
  }, [profileId ?? null]);
}

export async function updateReview(reviewId: string, rating: number, body: string) {
  const sb = getSupabaseBrowser();
  const { error } = await sb
    .from("reviews")
    .update({ rating, body: body.trim() || null })
    .eq("id", reviewId);
  if (error) throw error;
}
/** My own review of one deal, if I've left it — drives the chat prompt. */
export function useMyReviewFor(offerId: string | null) {
  const me = useProfile().data;
  const myProfileId = me?.id ?? null;
  const [version, setVersion] = useState(0);
  const state = useAsync<{ rating: number; body: string | null } | null>(async () => {
    if (!offerId || !myProfileId) return null;
    const { data, error } = await getSupabaseBrowser()
      .from("reviews")
      .select("rating,body")
      .eq("offer_id", offerId)
      .eq("reviewer_id", myProfileId)
      .maybeSingle();
    if (error) throw error;
    return data as { rating: number; body: string | null } | null;
  }, [offerId, myProfileId, version]);
  return { ...state, reload: useCallback(() => setVersion((v) => v + 1), []) };
}

export async function submitReview(args: {
  offerId: string;
  chatId: string;
  listingId: string;
  subjectId: string;
  rating: number;
  body: string;
}) {
  const me = myId();
  const { error } = await getSupabaseBrowser().from("reviews").insert({
    offer_id: args.offerId,
    chat_id: args.chatId,
    listing_id: args.listingId,
    reviewer_id: me,
    subject_id: args.subjectId,
    rating: args.rating,
    body: args.body.trim() || null,
  });
  if (error) throw error;
  // The subject's rating_avg just changed; drop our cached copy of our own profile
  // in case we reviewed ourselves out of a "new seller" state elsewhere.
  await refreshProfile();
}

/** Update the bits of my profile I'm allowed to set by hand. */
export async function updateMyProfile(patch: { name?: string; bio?: string | null }) {
  const me = profileState.data;
  if (!me) throw new Error("Sign in first.");
  const clean: { name?: string; bio?: string | null; initial?: string } = {};
  if (patch.name != null && patch.name.trim()) {
    clean.name = patch.name.trim();
    clean.initial = patch.name.trim().charAt(0).toUpperCase();
  }
  if (patch.bio !== undefined) clean.bio = patch.bio?.trim() || null;
  const { error } = await getSupabaseBrowser().from("profiles").update(clean).eq("id", me.id);
  if (error) throw error;
  await refreshProfile();
}

// ---------------------------------------------------------------------------
// Unread chats — read receipts in chat_reads, so the nav badge tells the truth
// ---------------------------------------------------------------------------
const unreadListeners = new Set<() => void>();
let unreadVersion = 0;
function bumpUnread() {
  unreadVersion += 1;
  unreadListeners.forEach((l) => l());
}

/**
 * One shared realtime channel for the whole app.
 *
 * Header and BottomNav both call useUnreadCount(), and supabase-js hands back the
 * *same* channel object for a repeated topic name — so the second caller was adding a
 * postgres_changes callback to an already-subscribed channel, which throws and took
 * every page with a header down to the error boundary. Created once, never torn down:
 * tearing it down and rebuilding it under the same topic races the same way, and one
 * open subscription for the app's lifetime costs nothing.
 */
let unreadChannelStarted = false;
function startUnreadChannel() {
  if (unreadChannelStarted) return;
  unreadChannelStarted = true;
  getSupabaseBrowser()
    .channel("global-messages")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => bumpUnread())
    .subscribe();
}

interface UnreadChatRow {
  id: string;
  messages: { sender_id: string; created_at: string }[];
  chat_reads: { last_read_at: string }[];
}

export function useUnreadCount(): number {
  const me = useProfile().data;
  const myProfileId = me?.id ?? null;
  const [, bump] = useState(0);
  useEffect(() => {
    if (!myProfileId) return;
    const l = () => bump((v) => v + 1);
    unreadListeners.add(l);
    startUnreadChannel();
    return () => {
      unreadListeners.delete(l);
    };
  }, [myProfileId]);

  const { data } = useAsync<number>(async () => {
    if (!myProfileId) return 0;
    // chat_reads is RLS-scoped to me, so the embed only ever returns my receipt.
    const { data: rows, error } = await getSupabaseBrowser()
      .from("chats")
      .select("id, messages(sender_id,created_at), chat_reads(last_read_at)");
    if (error) throw error;
    return (rows as unknown as UnreadChatRow[]).filter((c) => {
      const lastFromOther = c.messages
        .filter((m) => m.sender_id !== myProfileId)
        .map((m) => m.created_at)
        .sort()
        .at(-1);
      if (!lastFromOther) return false;
      const readAt = c.chat_reads?.[0]?.last_read_at;
      return !readAt || readAt < lastFromOther;
    }).length;
  }, [myProfileId, unreadVersion]);

  return data ?? 0;
}

export async function markChatRead(chatId: string) {
  const me = profileState.data;
  if (!me) return;
  const { error } = await getSupabaseBrowser()
    .from("chat_reads")
    .upsert({ chat_id: chatId, profile_id: me.id, last_read_at: new Date().toISOString() }, { onConflict: "chat_id,profile_id" });
  if (!error) bumpUnread();
}

// ---------------------------------------------------------------------------
// Honest selling aids — what similar things actually go for, and how many people
// are really watching for one
// ---------------------------------------------------------------------------
export interface PriceGuide {
  low: number;
  high: number;
  count: number;
}

/** 10th–90th percentile of nearby listings in a category. Null under 3 comparables. */
export function useComparablePrices(category: string, radiusKm = 10) {
  const origin = useUserLocation();
  const { lat, lng } = origin;
  return useAsync<PriceGuide | null>(async () => {
    if (!category) return null;
    const { data, error } = await getSupabaseBrowser()
      .from("listings")
      .select("price_num,lat,lng")
      .eq("category", category)
      .not("price_num", "is", null);
    if (error) throw error;
    const prices = (data as { price_num: number; lat: number | null; lng: number | null }[])
      .filter((r) => r.lat != null && r.lng != null && haversineKm({ lat, lng }, { lat: r.lat!, lng: r.lng! }) <= radiusKm)
      .map((r) => r.price_num)
      .sort((a, b) => a - b);
    if (prices.length < 3) return null;
    const at = (q: number) => prices[Math.min(prices.length - 1, Math.floor(q * (prices.length - 1)))];
    return { low: at(0.1), high: at(0.9), count: prices.length };
  }, [category, radiusKm, lat, lng]);
}

/** How many *other* people have a saved search this listing would match. */
export function useMatchingSavedSearchCount(text: string, category: string) {
  const q = text.trim();
  return useAsync<number>(async () => {
    if (!q) return 0;
    const { data, error } = await getSupabaseBrowser().rpc("matching_saved_search_count", { q, cat: category });
    if (error) throw error;
    return (data as number) ?? 0;
  }, [q, category]);
}

// ---------------------------------------------------------------------------
// Trust & safety — reports, blocks, and taking a listing down
// ---------------------------------------------------------------------------
export type ReportReason = "prohibited" | "scam" | "counterfeit" | "offensive" | "wrong-category" | "other";

export const reportReasons: { value: ReportReason; label: string }[] = [
  { value: "prohibited", label: "Prohibited item" },
  { value: "counterfeit", label: "Fake or counterfeit" },
  { value: "scam", label: "Scam or fraud" },
  { value: "offensive", label: "Offensive content" },
  { value: "wrong-category", label: "Wrong category" },
  { value: "other", label: "Something else" },
];

/** Flag a listing (and implicitly its seller) for review. */
export async function reportListing(listingId: string, sellerId: string | undefined, reason: ReportReason, details: string) {
  const me = myId();
  const { error } = await getSupabaseBrowser().from("reports").insert({
    reporter_id: me,
    listing_id: listingId,
    profile_id: sellerId ?? null,
    reason,
    details: details.trim() || null,
  });
  if (error) throw error;
}

export async function reportReview(reviewId: string, reason: ReportReason, details: string) {
  const me = myId();
  const { error } = await getSupabaseBrowser().from("reports").insert({
    reporter_id: me,
    review_id: reviewId,
    reason,
    details: details.trim() || null,
  });
  if (error) throw error;
}

/**
 * Hide someone. Enforced by RLS, not just the UI: their listings drop out of every
 * read, your shared chats disappear, and they can no longer message you.
 */
export async function blockProfile(profileId: string) {
  const me = myId();
  const { error } = await getSupabaseBrowser().from("blocks").insert({ blocker_id: me, blocked_id: profileId });
  if (error && error.code !== "23505") throw error; // already blocked is fine
}

export async function unblockProfile(profileId: string) {
  const me = myId();
  const { error } = await getSupabaseBrowser().from("blocks").delete().eq("blocker_id", me).eq("blocked_id", profileId);
  if (error) throw error;
}

export function useBlockedIds() {
  const me = useProfile().data;
  const myProfileId = me?.id ?? null;
  return useAsync<string[]>(async () => {
    if (!myProfileId) return [];
    const { data, error } = await getSupabaseBrowser().from("blocks").select("blocked_id");
    if (error) throw error;
    return (data ?? []).map((r) => r.blocked_id as string);
  }, [myProfileId]);
}

/** Mark sold / withdraw / relist. Removing is a status change — deleting the row
 *  would cascade away the listing's chats and their message history. */
export async function setListingStatus(listingId: string, status: "active" | "sold" | "removed") {
  const { error } = await getSupabaseBrowser().from("listings").update({ status }).eq("id", listingId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Likes — backed by saved_items, so they survive a refresh
// ---------------------------------------------------------------------------
const EMPTY_IDS: Set<string> = new Set();

export function useSavedItems() {
  const me = useProfile().data;
  const myId = me?.id ?? null;
  // Keyed by owner so signing out (or in as someone else) drops the previous set
  // without a synchronous reset in the effect.
  const [store, setStore] = useState<{ owner: string | null; ids: Set<string> }>({ owner: null, ids: EMPTY_IDS });
  const ids = myId && store.owner === myId ? store.ids : EMPTY_IDS;
  const idsRef = useRef(ids);
  useEffect(() => {
    idsRef.current = ids;
  }, [ids]);

  useEffect(() => {
    if (!myId) return;
    let alive = true;
    getSupabaseBrowser()
      .from("saved_items")
      .select("listing_id")
      .eq("user_id", myId)
      .then(({ data }) => {
        if (alive && data) setStore({ owner: myId, ids: new Set(data.map((r) => r.listing_id as string)) });
      });
    return () => {
      alive = false;
    };
  }, [myId]);

  const toggle = useCallback(
    async (listingId: string) => {
      if (!myId) return;
      const sb = getSupabaseBrowser();
      const had = idsRef.current.has(listingId);
      const flip = (add: boolean) =>
        setStore((prev) => {
          const next = new Set(prev.owner === myId ? prev.ids : EMPTY_IDS);
          if (add) next.add(listingId);
          else next.delete(listingId);
          return { owner: myId, ids: next };
        });
      // Optimistic: the heart flips immediately, the row follows.
      flip(!had);
      const { error } = had
        ? await sb.from("saved_items").delete().eq("user_id", myId).eq("listing_id", listingId)
        : await sb.from("saved_items").insert({ user_id: myId, listing_id: listingId });
      if (error) flip(had); // roll back if the write was rejected
    },
    [myId]
  );

  return { ids, toggle };
}

// ---------------------------------------------------------------------------
// Saved listings — fetches the actual Item objects the user has liked.
// Replaces the profile page's use of the catch-all useItems() which fetched
// every listing in the database just to look up a handful by id.
// ---------------------------------------------------------------------------
export function useSavedListings() {
  const me = useProfile().data;
  const myId = me?.id ?? null;
  return useDistances(
    useAsync<Item[]>(async () => {
      if (!myId) return [];
      // Two-step: saved_items gives us the IDs; then a single listing query for
      // just those IDs. RLS-safe because saved_items is scoped to the owner and
      // listings are world-readable (minus blocked sellers, which is correct).
      const { data: saved, error: savedErr } = await getSupabaseBrowser()
        .from("saved_items")
        .select("listing_id")
        .eq("user_id", myId);
      if (savedErr) throw savedErr;
      const ids = (saved ?? []).map((r) => r.listing_id as string);
      if (!ids.length) return [];
      const { data, error } = await getSupabaseBrowser()
        .from("listings")
        .select(LISTING_SELECT)
        .in("id", ids);
      if (error) throw error;
      return (data as ListingRow[]).map(rowToItem);
    }, [myId])
  );
}

// ---------------------------------------------------------------------------
// Profile names by ID — for the blocked-people list on /profile. Blocked
// sellers' listings are RLS-hidden, so useItems() couldn't resolve their names
// anyway (it silently returned "Someone you blocked" for every entry).
// Profiles are world-readable, so this always works.
// ---------------------------------------------------------------------------
export function useProfileNames(ids: string[]) {
  const key = [...ids].sort().join(",");
  return useAsync<Record<string, string>>(async () => {
    if (!ids.length) return {};
    const { data, error } = await getSupabaseBrowser()
      .from("profiles")
      .select("id,name")
      .in("id", ids);
    if (error) throw error;
    const map: Record<string, string> = {};
    for (const r of data ?? []) map[r.id as string] = r.name as string;
    return map;
  }, [key]);
}

// ---------------------------------------------------------------------------
// Admin — moderation surface for reports (P0-1)
// ---------------------------------------------------------------------------

/** Whether the signed-in user has the admin flag. Checked via an RPC to the
 *  is_admin() SECURITY DEFINER function so it's invisible outside the DB. */
export function useIsAdmin(): boolean {
  const me = useProfile().data;
  const myId = me?.id ?? null;
  const state = useAsync<boolean>(async () => {
    if (!myId) return false;
    const { data, error } = await getSupabaseBrowser().rpc("is_admin");
    if (error) return false;
    return !!data;
  }, [myId]);
  return state.data ?? false;
}

export interface Report {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
  listingId: string | null;
  listingName: string | null;
  listingStatus: string | null;
  reporterName: string | null;
  reportedName: string | null;
}

const REPORT_SELECT =
  "id,reason,details,status,created_at," +
  "listing:listings(id,name,status)," +
  "reporter:profiles!reports_reporter_id_fkey(name)," +
  "reported_user:profiles!reports_profile_id_fkey(name)";

interface ReportRow {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  listing: { id: string; name: string; status: string } | null;
  reporter: { name: string } | null;
  reported_user: { name: string } | null;
}

/** All reports, newest first. Only returns rows if the caller is_admin(). */
export function useReports() {
  const isAdmin = useIsAdmin();
  const [version, setVersion] = useState(0);
  const state = useAsync<Report[]>(async () => {
    if (!isAdmin) return [];
    const { data, error } = await getSupabaseBrowser()
      .from("reports")
      .select(REPORT_SELECT)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as unknown as ReportRow[]).map((r) => ({
      id: r.id,
      reason: r.reason,
      details: r.details,
      status: r.status,
      createdAt: r.created_at,
      listingId: r.listing?.id ?? null,
      listingName: r.listing?.name ?? null,
      listingStatus: r.listing?.status ?? null,
      reporterName: r.reporter?.name ?? null,
      reportedName: r.reported_user?.name ?? null,
    }));
  }, [isAdmin, version]);
  return { ...state, reload: useCallback(() => setVersion((v) => v + 1), []) };
}

/** Admin action: set a report's status. RLS enforces the admin check. */
export async function updateReportStatus(reportId: string, status: "reviewed" | "actioned") {
  const { error } = await getSupabaseBrowser().from("reports").update({ status }).eq("id", reportId);
  if (error) throw error;
}
