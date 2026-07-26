"use client";

import { createContext, useContext, useMemo, useState, ReactNode } from "react";
import { useSavedItems } from "@/lib/queries";

export type ProfileTab = "listings" | "sold" | "saved" | "reviews";

interface AppState {
  name: string;
  setName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  radiusKm: number;
  setRadiusKm: (v: number) => void;
  mapRadius: number;
  setMapRadius: (v: number) => void;
  activeCat: string;
  setActiveCat: (v: string) => void;
  likedIds: string[];
  toggleLike: (id: string) => void;
  isLiked: (id: string) => boolean;
  draft: string;
  setDraft: (v: string) => void;
  profTab: ProfileTab;
  setProfTab: (v: ProfileTab) => void;
  sellTitle: string;
  setSellTitle: (v: string) => void;
  sellPrice: string;
  setSellPrice: (v: string) => void;
  sellCat: string;
  setSellCat: (v: string) => void;
  sellNote: string;
  setSellNote: (v: string) => void;
}

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [name, setName] = useState("Aisha");
  const [phone, setPhone] = useState("");
  const [radiusKm, setRadiusKm] = useState(3);
  const [mapRadius, setMapRadius] = useState(3);
  const [activeCat, setActiveCat] = useState("All");
  // Likes live in the `saved_items` table now — this is just the mirror of it.
  const { ids: savedIds, toggle: toggleSaved } = useSavedItems();
  const [draft, setDraft] = useState("");
  const [profTab, setProfTab] = useState<ProfileTab>("listings");
  const [sellTitle, setSellTitle] = useState("Yamaha F310 acoustic guitar");
  const [sellPrice, setSellPrice] = useState("3,200");
  const [sellCat, setSellCat] = useState("Music");
  const [sellNote, setSellNote] = useState(
    "This guitar got me through 3 years of hostel life. Selling because I finally upgraded — it deserves someone who'll actually play it."
  );

  const value = useMemo<AppState>(
    () => ({
      name,
      setName,
      phone,
      setPhone,
      radiusKm,
      setRadiusKm,
      mapRadius,
      setMapRadius,
      activeCat,
      setActiveCat,
      likedIds: [...savedIds],
      toggleLike: toggleSaved,
      isLiked: (id: string) => savedIds.has(id),
      draft,
      setDraft,
      profTab,
      setProfTab,
      sellTitle,
      setSellTitle,
      sellPrice,
      setSellPrice,
      sellCat,
      setSellCat,
      sellNote,
      setSellNote,
    }),
    [name, phone, radiusKm, mapRadius, activeCat, savedIds, toggleSaved, draft, profTab, sellTitle, sellPrice, sellCat, sellNote]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
