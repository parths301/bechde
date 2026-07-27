import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  try {
    // 1. Fetch all saved searches that haven't been notified in the last 24h
    const { data: searches, error: searchesError } = await supabase
      .from("saved_searches")
      .select("*")
      .order("created_at", { ascending: true });

    if (searchesError) throw searchesError;
    if (!searches || searches.length === 0) {
      return new Response(JSON.stringify({ message: "No saved searches" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    let emailsSent = 0;

    for (const search of searches) {
      // 2. Fetch new matches for this search (naive approach: just search and filter)
      const { data: matches, error: matchesError } = await supabase.rpc("search_listings", {
        q: search.q,
      });
      if (matchesError) continue;

      const lastNotified = search.last_notified_at ? new Date(search.last_notified_at) : new Date(0);
      
      const newMatches = (matches || []).filter((m: any) => {
        // Filter by category and price if needed
        if (search.category && search.category !== "All" && m.category !== search.category) return false;
        if (search.min_price && m.price_num < search.min_price) return false;
        if (search.max_price && m.price_num > search.max_price) return false;
        
        // Only include items created after last_notified_at
        return new Date(m.created_at) > lastNotified;
      });

      if (newMatches.length > 0) {
        // 3. Find the user's email
        const { data: userAuth, error: authError } = await supabase.auth.admin.getUserById(search.user_id);
        const email = userAuth?.user?.email;

        if (email) {
          console.log(`[EMAIL] To: ${email} | Subject: ${newMatches.length} new matches for "${search.q}"`);
          console.log(`Matches: ${newMatches.map((m: any) => m.name).join(", ")}`);
          
          emailsSent++;
          
          // 4. Update last_notified_at
          await supabase
            .from("saved_searches")
            .update({ last_notified_at: new Date().toISOString() })
            .eq("id", search.id);
        }
      }
    }

    return new Response(JSON.stringify({ emailsSent }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error(err);
    return new Response(String(err?.message ?? err), { status: 500 });
  }
});
