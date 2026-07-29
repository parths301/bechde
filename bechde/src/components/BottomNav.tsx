"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { colors } from "@/lib/colors";
import { useUnreadCount } from "@/lib/queries";
import { IconHome, IconMap, IconPlus, IconChat, IconUser } from "./icons";

interface Tab {
  href: string;
  Icon: React.ComponentType<{ size?: number }>;
  label: string;
  center?: boolean;
  badge?: number;
}

const tabs: Tab[] = [
  { href: "/home", Icon: IconHome, label: "Home" },
  { href: "/map", Icon: IconMap, label: "Map" },
  { href: "/sell", Icon: IconPlus, label: "Sell", center: true },
  { href: "/chat", Icon: IconChat, label: "Chats" },
  { href: "/profile", Icon: IconUser, label: "You" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const unread = useUnreadCount();

  return (
    <nav
      className="bd-bottomnav"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        height: 64,
        background: colors.bg,
        borderTop: `1.5px dashed ${colors.divider}`,
        boxShadow: "0 -6px 20px rgba(60,45,20,.06)",
        alignItems: "center",
        justifyContent: "space-around",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {tabs.map((t) => {
        const active = pathname === t.href;
        const badge = t.href === "/chat" ? unread : t.badge;

        if (t.center) {
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-label={t.label}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1 }}
            >
              <div
                style={{
                  marginTop: -22,
                  width: 52,
                  height: 52,
                  borderRadius: "18px 18px 18px 6px",
                  background: colors.terracotta,
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  transform: "rotate(-4deg)",
                  boxShadow: "0 6px 16px rgba(232,106,79,.4)",
                  border: "3px solid #fff",
                }}
              >
                <t.Icon size={26} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 800, color: colors.clay, marginTop: 2 }}>{t.label}</span>
            </Link>
          );
        }

        return (
          <Link
            key={t.href}
            href={t.href}
            aria-label={t.label}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              flex: 1,
              color: active ? colors.clay : colors.textFaint,
            }}
          >
            <span style={{ position: "relative", display: "flex", lineHeight: 1 }}>
              <t.Icon size={22} />
              {badge ? (
                <span
                  style={{
                    position: "absolute",
                    top: -5,
                    right: -9,
                    background: colors.terracotta,
                    color: "#fff",
                    fontSize: 9,
                    fontWeight: 800,
                    borderRadius: 999,
                    padding: "1px 5px",
                  }}
                >
                  {badge}
                </span>
              ) : null}
            </span>
            <span style={{ fontSize: 10, fontWeight: active ? 800 : 700 }}>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
