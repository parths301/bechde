"use client";

import { createContext, useContext, useMemo, useState, ReactNode } from "react";
import { useSavedItems } from "@/lib/queries";

export type ProfileTab = "listings" | "sold" | "saved" | "reviews";

interface AppState {
  radiusKm: number;
  setRadiusKm: (v: number) => void;
  mapRadius: number;
  setMapRadius: (v: number) => void;
  activeCat: string;
  setActiveCat: (v: string) => void;
  toggleLike: (id: string) => void;
  isLiked: (id: string) => boolean;
  draft: string;
  setDraft: (v: string) => void;
  profTab: ProfileTab;
  setProfTab: (v: ProfileTab) => void;
}

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [radiusKm, setRadiusKm] = useState(3);
  const [mapRadius, setMapRadius] = useState(3);
  const [activeCat, setActiveCat] = useState("All");
  // Likes live in the `saved_items` table now — this is just the mirror of it.
  const { ids: savedIds, toggle: toggleSaved } = useSavedItems();
  const [draft, setDraft] = useState("");
  const [profTab, setProfTab] = useState<ProfileTab>("listings");

  const value = useMemo<AppState>(
    () => ({
      radiusKm,
      setRadiusKm,
      mapRadius,
      setMapRadius,
      activeCat,
      setActiveCat,
      toggleLike: toggleSaved,
      isLiked: (id: string) => savedIds.has(id),
      draft,
      setDraft,
      profTab,
      setProfTab,
    }),
    [radiusKm, mapRadius, activeCat, savedIds, toggleSaved, draft, profTab]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
