export type Category = "Gadgets" | "Furniture" | "Music" | "Fashion" | "Books" | "Everything";

export interface StoryStep {
  dot: string;
  title: string;
  when: string;
  text: string;
}

export interface Fact {
  k: string;
  v: string;
}

export interface Seller {
  /** profiles.id — present on DB-backed items, absent in the static seed data */
  id?: string;
  name: string;
  initial: string;
  color: string;
  /** display string, derived from ratingAvg/ratingCount — "★ 4.8" or "new seller" */
  rating: string;
  /** null until someone reviews them */
  ratingAvg?: number | null;
  ratingCount?: number;
  sold: number;
  replyTime: string;
}

export interface Item {
  id: string;
  name: string;
  label: string; // short label shown inside radar bubbles
  price: string;
  km: number;
  dist: string;
  category: Category;
  angle: string;
  note: string;
  negotiable: boolean;
  listedAgo: string;
  seller: Seller;
  story: StoryStep[];
  /** Authoring format for the seed. The database column is `attrs`; see 0018. */
  facts: Fact[];
  /** What the seller answered from their category's template: {condition: "Good"}. */
  attrs?: Record<string, string>;
  pickup: string;
  neighbourhood: string;
  publicSpot?: boolean;
  // cover photo URL (Supabase Storage) — undefined falls back to striped placeholder
  cover?: string;
  // every uploaded photo, cover first — drives the product gallery
  images?: string[];
  // when the listing was created (ISO) — DB rows only
  createdAt?: string;
  // 'active' | 'sold' — DB rows only
  status?: string;
  // real-world coordinates (approx neighbourhood centre) for OpenStreetMap
  lat: number;
  lng: number;
  // home radar hero position (px, within 560x520 box)
  home?: { x: number; y: number; size: number; dur: string; delay: string };
  // full map position (percentages)
  map?: { x: string; y: string; size: number; dur: string; delay: string };
}

// Approx neighbourhood-centre coordinates (Bangalore) for each listing.
// Real geocoding replaces these once listings carry captured lat/lng.
const COORDS: Record<string, { lat: number; lng: number }> = {
  "yamaha-f310": { lat: 12.9345, lng: 77.6275 }, // 5th Block, Koramangala
  "desk-lamp": { lat: 12.937, lng: 77.6215 }, // 1st Cross, Koramangala
  sneakers: { lat: 12.9116, lng: 77.6389 }, // HSR Layout
  bookshelf: { lat: 12.944, lng: 77.6285 }, // Ejipura
  "iphone-12": { lat: 12.9166, lng: 77.6101 }, // BTM Layout
  kettle: { lat: 12.925, lng: 77.5938 }, // Jayanagar
  "denim-jacket": { lat: 12.933, lng: 77.622 }, // Koramangala 4th Block
  "monitor-24": { lat: 12.9719, lng: 77.6412 }, // Indiranagar
  "bean-bag": { lat: 12.9569, lng: 77.7011 }, // Marathahalli
  kindle: { lat: 12.9304, lng: 77.6784 }, // Bellandur
  "wall-mirror": { lat: 12.9358, lng: 77.6255 }, // Koramangala 5th Block
  "study-table": { lat: 12.9352, lng: 77.6245 }, // Koramangala
  "boat-rockerz-550": { lat: 12.9126, lng: 77.641 }, // HSR Layout
  "single-mattress": { lat: 12.9425, lng: 77.63 }, // Ejipura
  "cricket-kit": { lat: 12.918, lng: 77.612 }, // BTM Layout
};

// The user's own location (Koramangala 5th Block) — centre of the radar/map.
export const USER_LOCATION = { lat: 12.9352, lng: 77.6245, label: "you · 5th Block" };

const rawItems: Omit<Item, "lat" | "lng">[] = [
  {
    id: "yamaha-f310",
    label: "acoustic guitar",
    name: "Yamaha F310 acoustic guitar",
    price: "₹3,200",
    km: 1.1,
    dist: "1.1 km",
    // Music, not Everything. A guitar in the catch-all is how it ended up unfilterable
    // once before (README §3.5), and it left the Music category with a single amp in it.
    category: "Music",
    angle: "60deg",
    note: "This guitar got me through 3 years of hostel life. Selling because I finally upgraded — it deserves someone who'll actually play it.",
    negotiable: true,
    listedAgo: "listed 2 days ago",
    neighbourhood: "5th Block, Koramangala",
    seller: { name: "Rohan T.", initial: "R", color: "#3E9B8F", rating: "★ 4.9", sold: 11, replyTime: "10 min" },
    story: [
      { dot: "#F2A93B", title: "Bought new", when: "Jun 2023", text: "From Furtados, MG Road. Bill and warranty card included." },
      { dot: "#3E9B8F", title: "Well loved", when: "2023–2026", text: "Hostel jam sessions, two open mics, zero drops. New strings 3 months ago." },
      { dot: "#E86A4F", title: "Listed on Bech De", when: "2 days ago", text: "Upgraded to an electro-acoustic. This one needs a new home." },
    ],
    facts: [
      { k: "Condition", v: "Great · minor scuffs" },
      { k: "Age", v: "3 years" },
      { k: "Includes", v: "Soft case + picks" },
      { k: "Reason", v: "Upgraded" },
    ],
    pickup: "Pickup near 5th Block, Koramangala",
    home: { x: 388, y: 60, size: 78, dur: "4.1s", delay: ".6s" },
    map: { x: "64%", y: "12%", size: 76, dur: "4.1s", delay: ".6s" },
  },
  {
    id: "desk-lamp",
    label: "desk lamp",
    name: "Wooden-base desk lamp",
    price: "₹450",
    km: 1,
    dist: "0.9 km",
    category: "Furniture",
    angle: "45deg",
    note: "Warm light, adjustable neck. Kept my late-night study sessions bearable — passing the favour on.",
    negotiable: true,
    listedAgo: "listed 4 days ago",
    neighbourhood: "1st Cross, Koramangala",
    seller: { name: "Meera K.", initial: "M", color: "#F2A93B", rating: "★ 4.7", sold: 5, replyTime: "20 min" },
    story: [
      { dot: "#F2A93B", title: "Bought for hostel desk", when: "2024", text: "Picked up from a local electronics store near college." },
      { dot: "#E86A4F", title: "Listed on Bech De", when: "4 days ago", text: "Room's getting a ceiling light — this one's redundant now." },
    ],
    facts: [
      { k: "Condition", v: "Good · light scratches" },
      { k: "Age", v: "1.5 years" },
      { k: "Includes", v: "Bulb included" },
      { k: "Reason", v: "Redundant" },
    ],
    pickup: "Pickup near 1st Cross, Koramangala",
    home: { x: 96, y: 74, size: 64, dur: "3.4s", delay: "0s" },
    map: { x: "22%", y: "18%", size: 62, dur: "3.4s", delay: "0s" },
  },
  {
    id: "sneakers",
    label: "sneakers",
    name: "Sneakers, size UK 9",
    price: "₹900",
    km: 4,
    dist: "4.2 km",
    category: "Fashion",
    angle: "30deg",
    note: "Bought a fancier pair, these still slap. Box included, worn maybe a dozen times.",
    negotiable: true,
    listedAgo: "listed 6 days ago",
    neighbourhood: "HSR Layout",
    seller: { name: "Kabir M.", initial: "K", color: "#E86A4F", rating: "★ 4.8", sold: 8, replyTime: "15 min" },
    story: [
      { dot: "#F2A93B", title: "Bought online", when: "2025", text: "Ordered a size too enthusiastically during a sale." },
      { dot: "#E86A4F", title: "Listed on Bech De", when: "6 days ago", text: "Barely worn, deserve more steps than I'm giving them." },
    ],
    facts: [
      { k: "Condition", v: "Like new" },
      { k: "Size", v: "UK 9" },
      { k: "Includes", v: "Original box" },
      { k: "Reason", v: "Wrong fit" },
    ],
    pickup: "Pickup near HSR Layout",
    home: { x: 448, y: 232, size: 60, dur: "3.1s", delay: ".3s" },
    map: { x: "80%", y: "38%", size: 58, dur: "3.1s", delay: ".3s" },
  },
  {
    id: "bookshelf",
    label: "bookshelf",
    name: "3-tier wooden bookshelf",
    price: "₹1,500",
    km: 3,
    dist: "2.8 km",
    category: "Furniture",
    angle: "75deg",
    note: "Survived three room shifts. Sturdy, no wobble, holds way more than it looks like it should.",
    negotiable: false,
    listedAgo: "listed 1 week ago",
    neighbourhood: "Ejipura",
    seller: { name: "Priya R.", initial: "P", color: "#E86A4F", rating: "★ 4.9", sold: 6, replyTime: "30 min" },
    story: [
      { dot: "#F2A93B", title: "Bought secondhand", when: "2022", text: "Got it from a senior who was graduating — paying it forward." },
      { dot: "#E86A4F", title: "Listed on Bech De", when: "1 week ago", text: "Moving to a smaller room, no space for it anymore." },
    ],
    facts: [
      { k: "Condition", v: "Sturdy · minor wear" },
      { k: "Material", v: "Solid wood" },
      { k: "Includes", v: "Disassembles easily" },
      { k: "Reason", v: "Moving rooms" },
    ],
    pickup: "Pickup near Ejipura",
    home: { x: 60, y: 250, size: 72, dur: "3.8s", delay: ".9s" },
    map: { x: "12%", y: "48%", size: 70, dur: "3.8s", delay: ".9s" },
  },
  {
    id: "iphone-12",
    label: "iPhone 12",
    name: "iPhone 12, 128GB",
    price: "₹22,000",
    km: 2,
    dist: "1.6 km",
    category: "Gadgets",
    angle: "45deg",
    note: "Battery health 87%, no dents, screen protector on since day one. Selling to fund the next upgrade.",
    negotiable: true,
    listedAgo: "listed 3 days ago",
    neighbourhood: "BTM Layout",
    seller: { name: "Arjun V.", initial: "A", color: "#8A5A2B", rating: "★ 4.6", sold: 3, replyTime: "5 min" },
    story: [
      { dot: "#F2A93B", title: "Bought new", when: "Nov 2021", text: "Original bill and box available." },
      { dot: "#3E9B8F", title: "Well kept", when: "2021–2026", text: "Case + screen guard on since day one, battery health 87%." },
      { dot: "#E86A4F", title: "Listed on Bech De", when: "3 days ago", text: "Upgrading — this one still has plenty of life left." },
    ],
    facts: [
      { k: "Condition", v: "Excellent" },
      { k: "Battery", v: "87% health" },
      { k: "Includes", v: "Box + bill" },
      { k: "Reason", v: "Upgraded" },
    ],
    pickup: "Pickup near BTM Layout",
    home: { x: 170, y: 372, size: 66, dur: "3.5s", delay: ".2s" },
    map: { x: "30%", y: "72%", size: 66, dur: "3.5s", delay: ".2s" },
  },
  {
    id: "kettle",
    label: "kettle",
    name: "Electric kettle, 1.5L",
    price: "₹350",
    km: 5,
    dist: "4.8 km",
    category: "Everything",
    angle: "60deg",
    note: "Made a thousand cups of instant noodles in this. Works perfectly, auto shut-off included.",
    negotiable: false,
    listedAgo: "listed 5 days ago",
    neighbourhood: "Jayanagar",
    seller: { name: "Sana F.", initial: "S", color: "#3E9B8F", rating: "★ 4.5", sold: 4, replyTime: "40 min" },
    story: [
      { dot: "#F2A93B", title: "Bought for PG", when: "2024", text: "Essential hostel-life purchase." },
      { dot: "#E86A4F", title: "Listed on Bech De", when: "5 days ago", text: "Moving in with family, kitchen's fully stocked there." },
    ],
    facts: [
      { k: "Condition", v: "Works perfectly" },
      { k: "Capacity", v: "1.5 litres" },
      { k: "Includes", v: "Original cord" },
      { k: "Reason", v: "Moving out" },
    ],
    pickup: "Pickup near Jayanagar",
    home: { x: 356, y: 356, size: 58, dur: "3s", delay: ".7s" },
    map: { x: "62%", y: "76%", size: 56, dur: "3s", delay: ".7s" },
  },
  {
    id: "denim-jacket",
    label: "denim jacket",
    name: "Oversized denim jacket",
    price: "₹700",
    km: 1,
    dist: "0.7 km",
    category: "Fashion",
    angle: "30deg",
    note: "Thrifted, then loved for two winters. Slightly faded in the best way — going to whoever needs it next.",
    negotiable: true,
    listedAgo: "listed today",
    neighbourhood: "Koramangala 4th Block",
    seller: { name: "Ananya S.", initial: "A", color: "#F2A93B", rating: "★ 4.8", sold: 7, replyTime: "8 min" },
    story: [
      { dot: "#F2A93B", title: "Thrifted", when: "2024", text: "Found at a flea market, wore it everywhere since." },
      { dot: "#E86A4F", title: "Listed on Bech De", when: "today", text: "Closet's overflowing — time to let someone else wear it in." },
    ],
    facts: [
      { k: "Condition", v: "Good · faded wash" },
      { k: "Size", v: "M / L (oversized)" },
      { k: "Includes", v: "—" },
      { k: "Reason", v: "Closet clear-out" },
    ],
    pickup: "Pickup near Koramangala 4th Block",
    home: { x: 262, y: 34, size: 56, dur: "3.6s", delay: ".4s" },
    map: { x: "45%", y: "22%", size: 54, dur: "3.6s", delay: ".4s" },
  },
  {
    id: "monitor-24",
    label: "monitor 24\"",
    name: "24\" monitor, Full HD",
    price: "₹5,500",
    km: 4,
    dist: "3.9 km",
    category: "Gadgets",
    angle: "75deg",
    note: "Great for WFH or gaming on the side. Zero dead pixels, comes with the original stand.",
    negotiable: true,
    listedAgo: "listed 2 days ago",
    neighbourhood: "Indiranagar",
    seller: { name: "Vikram N.", initial: "V", color: "#E86A4F", rating: "★ 4.7", sold: 9, replyTime: "12 min" },
    story: [
      { dot: "#F2A93B", title: "Bought new", when: "2023", text: "Set up for a work-from-home stint." },
      { dot: "#E86A4F", title: "Listed on Bech De", when: "2 days ago", text: "Switched to a laptop-only setup, don't need the extra screen." },
    ],
    facts: [
      { k: "Condition", v: "Excellent" },
      { k: "Resolution", v: "1920×1080" },
      { k: "Includes", v: "Stand + cable" },
      { k: "Reason", v: "Setup change" },
    ],
    pickup: "Pickup near Indiranagar",
    map: { x: "74%", y: "60%", size: 64, dur: "3.3s", delay: ".5s" },
  },
  {
    id: "bean-bag",
    label: "bean bag",
    name: "XXL bean bag",
    price: "₹950",
    km: 7,
    dist: "6.6 km",
    category: "Furniture",
    angle: "45deg",
    note: "The comfiest corner of my room for two years. Still holds its shape, just needs a new home.",
    negotiable: true,
    listedAgo: "listed 1 week ago",
    neighbourhood: "Marathahalli",
    seller: { name: "Devika R.", initial: "D", color: "#F2A93B", rating: "★ 4.6", sold: 2, replyTime: "1 hr" },
    story: [
      { dot: "#F2A93B", title: "Bought new", when: "2024", text: "For a cozier reading corner in the hostel room." },
      { dot: "#E86A4F", title: "Listed on Bech De", when: "1 week ago", text: "Graduating and can't carry it home — hoping it finds a good corner." },
    ],
    facts: [
      { k: "Condition", v: "Good · holds shape" },
      { k: "Size", v: "XXL" },
      { k: "Includes", v: "—" },
      { k: "Reason", v: "Graduating" },
    ],
    pickup: "Pickup near Marathahalli",
    map: { x: "18%", y: "30%", size: 52, dur: "3.7s", delay: ".1s" },
  },
  {
    id: "kindle",
    label: "kindle",
    name: "Kindle Paperwhite",
    price: "₹4,800",
    km: 3,
    dist: "2.4 km",
    category: "Gadgets",
    angle: "60deg",
    note: "Read about 40 books on this thing. Screen's flawless, comes with a case.",
    negotiable: true,
    listedAgo: "listed 4 days ago",
    neighbourhood: "Bellandur",
    seller: { name: "Nikhil J.", initial: "N", color: "#3E9B8F", rating: "★ 5.0", sold: 5, replyTime: "10 min" },
    story: [
      { dot: "#F2A93B", title: "Bought new", when: "2023", text: "Got into reading during exam-prep procrastination." },
      { dot: "#E86A4F", title: "Listed on Bech De", when: "4 days ago", text: "Switched to audiobooks — this deserves an active reader." },
    ],
    facts: [
      { k: "Condition", v: "Flawless screen" },
      { k: "Storage", v: "8GB" },
      { k: "Includes", v: "Cover case" },
      { k: "Reason", v: "Switched formats" },
    ],
    pickup: "Pickup near Bellandur",
    map: { x: "52%", y: "58%", size: 58, dur: "3.2s", delay: ".8s" },
  },
  {
    id: "wall-mirror",
    label: "wall mirror",
    name: "Round wall mirror",
    price: "₹400",
    km: 1,
    dist: "0.5 km",
    category: "Furniture",
    angle: "30deg",
    note: "Simple wooden-frame mirror, no cracks or fog spots. Just redecorating and it doesn't match anymore.",
    negotiable: false,
    listedAgo: "listed today",
    neighbourhood: "Koramangala 5th Block",
    seller: { name: "Ritika S.", initial: "R", color: "#E86A4F", rating: "★ 4.9", sold: 4, replyTime: "20 min" },
    story: [
      { dot: "#F2A93B", title: "Bought for the room", when: "2025", text: "Picked up from a local home store." },
      { dot: "#E86A4F", title: "Listed on Bech De", when: "today", text: "Redecorated and it clashes with the new palette." },
    ],
    facts: [
      { k: "Condition", v: "No cracks/fog" },
      { k: "Diameter", v: "18 inches" },
      { k: "Includes", v: "Wall hook" },
      { k: "Reason", v: "Redecorating" },
    ],
    pickup: "Pickup near Koramangala 5th Block",
    map: { x: "38%", y: "40%", size: 50, dur: "3.9s", delay: ".35s" },
  },
  {
    id: "study-table",
    label: "study table",
    name: "Study table + chair",
    price: "₹1,800",
    km: 0.4,
    dist: "0.4 km",
    category: "Furniture",
    angle: "75deg",
    note: "Survived two semesters of all-nighters. Solid wood, zero wobble.",
    negotiable: true,
    listedAgo: "listed 3 days ago",
    neighbourhood: "Koramangala",
    seller: { name: "Ananya S.", initial: "A", color: "#F2A93B", rating: "★ 4.8", sold: 7, replyTime: "8 min" },
    story: [
      { dot: "#F2A93B", title: "Bought for hostel", when: "2024", text: "Set up for late-night study sessions." },
      { dot: "#E86A4F", title: "Listed on Bech De", when: "3 days ago", text: "Graduating soon, can't take the furniture home." },
    ],
    facts: [
      { k: "Condition", v: "Solid · zero wobble" },
      { k: "Material", v: "Solid wood" },
      { k: "Includes", v: "Matching chair" },
      { k: "Reason", v: "Graduating" },
    ],
    pickup: "Pickup near Koramangala",
  },
  {
    id: "boat-rockerz-550",
    label: "headphones",
    name: "Boat Rockerz 550",
    price: "₹850",
    km: 1.1,
    dist: "1.1 km",
    category: "Gadgets",
    angle: "30deg",
    note: "Bought a fancier pair, these still slap. Box included.",
    negotiable: true,
    listedAgo: "sold in 3 days",
    neighbourhood: "HSR Layout",
    seller: { name: "Kabir M.", initial: "K", color: "#E86A4F", rating: "★ 4.8", sold: 8, replyTime: "15 min" },
    story: [
      { dot: "#F2A93B", title: "Bought new", when: "2024", text: "Everyday commute headphones." },
      { dot: "#E86A4F", title: "Sold on Bech De", when: "3 days after listing", text: "Snapped up fast — great condition, fair price." },
    ],
    facts: [
      { k: "Condition", v: "Like new" },
      { k: "Battery", v: "~15 hrs" },
      { k: "Includes", v: "Original box" },
      { k: "Reason", v: "Upgraded pair" },
    ],
    pickup: "Pickup near HSR Layout",
  },
  {
    id: "single-mattress",
    label: "mattress",
    name: "Single mattress",
    price: "₹1,200",
    km: 1.8,
    dist: "1.8 km",
    category: "Furniture",
    angle: "45deg",
    note: "Moving back home after graduation. Barely 8 months old.",
    negotiable: true,
    listedAgo: "listed 2 days ago",
    neighbourhood: "Ejipura",
    seller: { name: "Priya R.", initial: "P", color: "#E86A4F", rating: "★ 4.9", sold: 6, replyTime: "30 min" },
    story: [
      { dot: "#F2A93B", title: "Bought new", when: "Nov 2025", text: "For the hostel room, barely used since." },
      { dot: "#E86A4F", title: "Listed on Bech De", when: "2 days ago", text: "Graduating and moving back home — no space to carry it." },
    ],
    facts: [
      { k: "Condition", v: "Like new" },
      { k: "Size", v: "Single / 72×36\"" },
      { k: "Age", v: "8 months" },
      { k: "Reason", v: "Graduating" },
    ],
    pickup: "Pickup near Ejipura",
  },
  {
    id: "cricket-kit",
    label: "cricket kit",
    name: "Cricket kit (full)",
    price: "₹2,400",
    km: 2.6,
    dist: "2.6 km",
    category: "Everything",
    angle: "60deg",
    note: "Bat, pads, gloves — retiring from gully cricket, sadly.",
    negotiable: true,
    listedAgo: "listed 5 days ago",
    neighbourhood: "BTM Layout",
    seller: { name: "Arjun V.", initial: "A", color: "#8A5A2B", rating: "★ 4.6", sold: 3, replyTime: "5 min" },
    story: [
      { dot: "#F2A93B", title: "Bought as a set", when: "2023", text: "Weekend gully cricket essentials." },
      { dot: "#E86A4F", title: "Listed on Bech De", when: "5 days ago", text: "Knees have retired before the kit did." },
    ],
    facts: [
      { k: "Condition", v: "Well used, sturdy" },
      { k: "Includes", v: "Bat, pads, gloves" },
      { k: "Size", v: "Full / adult" },
      { k: "Reason", v: "Retiring from the sport" },
    ],
    pickup: "Pickup near BTM Layout",
  },
];

export const items: Item[] = rawItems.map((i) => ({
  ...i,
  lat: COORDS[i.id]?.lat ?? USER_LOCATION.lat,
  lng: COORDS[i.id]?.lng ?? USER_LOCATION.lng,
}));


export const sellCategories: { icon: string; name: string }[] = [
  { icon: "📱", name: "Gadgets" },
  { icon: "🛋️", name: "Furniture" },
  { icon: "🎸", name: "Music" },
  { icon: "👕", name: "Fashion" },
  { icon: "📚", name: "Books" },
  { icon: "✨", name: "Everything else" },
];

export const homeCategories: { icon: string; name: string }[] = [
  { icon: "📱", name: "Gadgets" },
  { icon: "🛋️", name: "Furniture" },
  { icon: "🎸", name: "Music" },
  { icon: "👕", name: "Fashion" },
  { icon: "📚", name: "Books" },
  { icon: "✨", name: "Everything" },
];

// The map's own category list used to live here and silently omitted Music, so a
// guitar could never be filtered. Both the map and /search now share
// `searchCategories` in src/lib/search.ts, built from homeCategories above.

export interface ChatThread {
  id: string;
  item: string;
  itemId: string;
  last: string;
  time: string;
  initial: string;
  avatar: string;
  angle: string;
  active: boolean;
  cover?: string;
}

export const chatThreads: ChatThread[] = [
  { id: "yamaha-f310", item: "Yamaha F310 guitar", itemId: "yamaha-f310", last: "Offer made: ₹2,900", time: "4:26 PM", initial: "R", avatar: "#3E9B8F", angle: "60deg", active: true },
  { id: "study-table", item: "Study table + chair", itemId: "study-table", last: "Can you do ₹1,500?", time: "1:10 PM", initial: "A", avatar: "#F2A93B", angle: "45deg", active: false },
  { id: "boat-rockerz-550", item: "Boat Rockerz 550", itemId: "boat-rockerz-550", last: "You: sold, congrats! 🎉", time: "Mon", initial: "K", avatar: "#E86A4F", angle: "30deg", active: false },
  { id: "mini-fridge", item: "Mini fridge", itemId: "study-table", last: "Is it still available?", time: "Sun", initial: "P", avatar: "#8A5A2B", angle: "75deg", active: false },
];
