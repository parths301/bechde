import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bd-app-shell" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header />
      {children}
      <BottomNav />
    </div>
  );
}
