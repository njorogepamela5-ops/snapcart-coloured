import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function syncProducts() {
  const { data: supermarkets, error: supError } = await supabase
    .from("supermarkets")
    .select("id, api_url");

  if (supError) return console.error("Error fetching supermarkets:", supError);

  for (const market of supermarkets) {
    try {
      console.log(`🔄 Fetching products for ${market.id}...`);
      const res = await fetch(market.api_url);
      const externalProducts = await res.json();

      const products = externalProducts.map(p => ({
        name: p.name,
        description: p.description || null,
        price: p.price || 0,
        stock: p.stock || 0,
        image_url: p.image_url || null,
        category: p.category || null,
        supermarket_id: market.id,
      }));

      const { data, error } = await supabase
        .from("products")
        .upsert(products, { onConflict: ["id"] });

      if (error) console.error(`❌ Error syncing ${market.id}:`, error);
      else console.log(`✅ Synced ${data.length} products for ${market.id}`);
    } catch (err) {
      console.error(`❌ Unexpected error for ${market.id}:`, err);
    }
  }
}

syncProducts();
