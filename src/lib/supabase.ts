import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const fallbackUrl = "https://vjotksbiyfeuwgntxsww.supabase.co";

export const configReady = Boolean(
  url &&
  anonKey &&
  !anonKey.includes("PEGAR_AQUI") &&
  !anonKey.includes("missing-public-key")
);

export const supabase = createClient(
  url || fallbackUrl,
  anonKey || "missing-public-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);
