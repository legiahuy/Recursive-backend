import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "";
// Prioritize Service Role Key for backend operations to bypass RLS
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    "Supabase credentials not found. Storage features will be disabled.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// export const STORAGE_BUCKET =
//   process.env.SUPABASE_STORAGE_BUCKET || "product-images";
