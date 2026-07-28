import { MetadataRoute } from "next";
import { createPublicClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://bechde.com";
  
  const routes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}`, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/home`, lastModified: new Date(), changeFrequency: "always", priority: 0.9 },
    { url: `${baseUrl}/search`, lastModified: new Date(), changeFrequency: "always", priority: 0.8 },
  ];

  try {
    // Anon: the sitemap should only ever list what a logged-out visitor can open.
    const sb = createPublicClient();
    const { data: listings } = await sb
      .from("listings")
      .select("id, created_at")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (listings) {
      for (const item of listings) {
        routes.push({
          url: `${baseUrl}/product/${item.id}`,
          lastModified: new Date(item.created_at),
          changeFrequency: "weekly",
          priority: 0.7,
        });
      }
    }
  } catch (e) {
    console.error("Sitemap generation error:", e);
  }

  return routes;
}
