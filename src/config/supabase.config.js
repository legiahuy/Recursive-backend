import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase credentials not found. Storage features will be disabled.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// export const STORAGE_BUCKET =
//   process.env.SUPABASE_STORAGE_BUCKET || "product-images";
