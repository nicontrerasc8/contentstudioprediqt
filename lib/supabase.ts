import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

let browserClient: SupabaseClient<Database> | null = null;

function requirePublicEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

export function getSupabaseServerClient(accessToken: string) {
  if (typeof window !== "undefined") {
    throw new Error("The Supabase server client is server-only.");
  }

  return createClient<Database>(
    requirePublicEnv(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      "NEXT_PUBLIC_SUPABASE_URL",
    ),
    requirePublicEnv(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    },
  );
}

export function getSupabaseBrowserClient() {
  if (typeof window === "undefined") {
    throw new Error("The Supabase browser client can only run in the browser.");
  }

  if (!browserClient) {
    browserClient = createClient<Database>(
      requirePublicEnv(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        "NEXT_PUBLIC_SUPABASE_URL",
      ),
      requirePublicEnv(
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      ),
    );
  }

  return browserClient;
}
