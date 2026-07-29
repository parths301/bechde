"use client";

import { useAutoLocate } from "@/lib/queries";

/**
 * Mounted once by the app layout so the browser is asked for a position at most once
 * per person, rather than once per LocationChip per screen. Renders nothing.
 */
export default function AutoLocate() {
  useAutoLocate();
  return null;
}
