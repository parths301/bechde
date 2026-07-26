import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bd-app-shell" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <a href="#main" className="bd-skip-link">
        Skip to content
      </a>
      <Header />
      <main id="main" style={{ display: "contents" }}>
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
