"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { colors } from "@/lib/colors";
import { useIsAdmin } from "@/lib/queries";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/listings", label: "Listings" },
  { href: "/admin/users", label: "People" },
  { href: "/admin/taxonomy", label: "Taxonomy" },
  { href: "/admin/audit", label: "Audit log" },
] as const;

export default function AdminLayout({ children }: { children: ReactNode }) {
  const isAdmin = useIsAdmin();
  const path = usePathname();

  // No redirect here: RLS already returns nothing to a non-admin, and bouncing on a
  // hook that starts `false` would throw a real admin off the page mid-load.
  if (!isAdmin) {
    return (
      <div
        style={{
          flex: 1,
          display: "grid",
          placeItems: "center",
          minHeight: "calc(100vh - 76px)",
          color: colors.textFaint,
          fontWeight: 700,
          padding: 24,
          textAlign: "center",
        }}
      >
        Checking permissions…
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", width: "100%", minWidth: 0, padding: "30px 24px 44px" }}>
      <nav
        aria-label="Admin sections"
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 26,
          paddingBottom: 16,
          borderBottom: `2px dashed ${colors.divider}`,
        }}
      >
        {TABS.map((t) => {
          const active = t.href === "/admin" ? path === "/admin" : path.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              style={{
                borderRadius: 999,
                padding: "8px 16px",
                fontSize: 13.5,
                fontWeight: 800,
                textDecoration: "none",
                border: `1.5px solid ${active ? colors.ink : colors.sand}`,
                background: active ? colors.ink : "#fff",
                color: active ? colors.bg : colors.ink,
              }}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
