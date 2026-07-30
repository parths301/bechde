import { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductClient from "./ProductClient";
import { createPublicClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  // Anon, not service-role: the card a scraper gets should be the one a logged-out
  // visitor would see. Withdrawn listings stay readable (chat history needs them), so
  // status is filtered here rather than left to RLS.
  const sb = createPublicClient();

  const { data: item } = await sb
    .from("listings")
    .select("name, note, listing_images(url, sort)")
    .eq("id", id)
    .eq("status", "active")
    .maybeSingle();

  if (!item) {
    return { title: "Listing not found — Bech De" };
  }

  const coverImg = (item.listing_images || []).sort((a, b) => a.sort - b.sort)[0]?.url;

  return {
    title: `${item.name} - Bech De`,
    description: item.note ?? `Check out ${item.name} on Bech De`,
    openGraph: {
      title: item.name,
      description: item.note ?? `Check out ${item.name} on Bech De`,
      images: coverImg ? [{ url: coverImg }] : [],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: item.name,
      description: item.note ?? `Check out ${item.name} on Bech De`,
      images: coverImg ? [coverImg] : [],
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;

  // Decide existence here, on the server, not in ProductClient.
  //
  // ProductClient calls notFound() too, but by the time a client component runs the
  // 200 has already gone out — so a dead listing answered "200 OK" with a page saying
  // "Nothing here", which is exactly the soft-404 that search engines index and keep
  // serving. The listing has to be missing *before* the response starts to get a real
  // 404. Anon client, matching generateMetadata: a scraper should see what a
  // logged-out visitor sees.
  const { data } = await createPublicClient().from("listings").select("id").eq("id", id).maybeSingle();
  if (!data) notFound();

  return <ProductClient />;
}
