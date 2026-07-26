import type { Metadata, Viewport } from "next";
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

// Absolute URLs for OG/Twitter cards. Vercel sets VERCEL_PROJECT_PRODUCTION_URL;
// override with NEXT_PUBLIC_SITE_URL once a custom domain is attached.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Bech De — buy & sell nearby",
    template: "%s · Bech De",
  },
  description: "Bech De — a neighbourhood resale marketplace. Buy and sell with people near you.",
  applicationName: "Bech De",
  keywords: ["resale", "second-hand", "marketplace", "neighbourhood", "Bengaluru", "buy and sell"],
  openGraph: {
    type: "website",
    siteName: "Bech De",
    title: "Bech De — good stuff, walking distance",
    description: "Buy and sell with people in your own neighbourhood. No shipping, no strangers from far away.",
    locale: "en_IN",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "Bech De — good stuff, walking distance",
    description: "Buy and sell with people in your own neighbourhood.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FBF6ED",
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
