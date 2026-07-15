import type { Metadata } from "next";
import { Bricolage_Grotesque, Karla } from "next/font/google";
import { AppStateProvider } from "@/lib/store";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
});

const karla = Karla({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-karla",
});

export const metadata: Metadata = {
  title: "Bech De — buy & sell nearby",
  description: "Bech De — a neighbourhood resale marketplace. Buy and sell with people near you.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${karla.variable}`}>
      <body>
        <AppStateProvider>{children}</AppStateProvider>
      </body>
    </html>
  );
}
