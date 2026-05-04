import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

let adminClient: SupabaseClient<Database> | null = null;
let browserClient: SupabaseClient<Database> | null = null;

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function requirePublicEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

export function getSupabaseAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("The Supabase service role client is server-only.");
  }

  if (!adminClient) {
    adminClient = createClient<Database>(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  return adminClient;
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
