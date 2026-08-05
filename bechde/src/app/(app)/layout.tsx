import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import AutoLocate from "@/components/AutoLocate";
import { getServerT } from "@/lib/i18n/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const t = await getServerT();

  return (
    <div className="bd-app-shell" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <a href="#main" className="bd-skip-link">
        {t("nav.skipToContent")}
      </a>
      <AutoLocate />
      <Header />
      <main id="main" style={{ display: "contents" }}>
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
