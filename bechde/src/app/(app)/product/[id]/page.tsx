import { Metadata, ResolvingMetadata } from "next";
import ProductClient from "./ProductClient";
import { createAdminClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props, parent: ResolvingMetadata): Promise<Metadata> {
  const { id } = await params;
  const sb = createAdminClient();
  
  // Fetch basic details for OG tags
  const { data: item } = await sb
    .from("listings")
    .select("name, note, listing_images(url, sort)")
    .eq("id", id)
    .single();

  if (!item) {
    return { title: "Listing not found" };
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
  // Await params just to fulfill Next.js 15+ constraints if needed,
  // though ProductClient will use `useParams()` on the client side.
  await params;
  return <ProductClient />;
}
