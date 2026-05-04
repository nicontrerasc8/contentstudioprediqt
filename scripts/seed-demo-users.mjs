import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const envFiles = [".env.local", ".env"];

for (const file of envFiles) {
  if (!existsSync(file)) {
    continue;
  }

  const lines = readFileSync(file, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");

    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator);
    const value = trimmed.slice(separator + 1).replace(/^["']|["']$/g, "");

    process.env[key] ??= value;
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
  );
}

const demoUsers = [
  {
    email: process.env.DEMO_CREATOR_EMAIL || "creador@content-suite.local",
    password: process.env.DEMO_CREATOR_PASSWORD || "Creador123!",
    fullName: "Creador Demo",
    role: "creador",
  },
  {
    email: process.env.DEMO_APPROVER_A_EMAIL || "aprobador.a@content-suite.local",
    password: process.env.DEMO_APPROVER_A_PASSWORD || "AprobadorA123!",
    fullName: "Aprobador A Demo",
    role: "aprobador_a",
  },
  {
    email: process.env.DEMO_APPROVER_B_EMAIL || "aprobador.b@content-suite.local",
    password: process.env.DEMO_APPROVER_B_PASSWORD || "AprobadorB123!",
    fullName: "Aprobador B Demo",
    role: "aprobador_b",
  },
];

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function findUserByEmail(email) {
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data.users.find(
    (user) => user.email?.toLowerCase() === email.toLowerCase(),
  );
}

for (const demoUser of demoUsers) {
  const existingUser = await findUserByEmail(demoUser.email);
  const authResult = existingUser
    ? await supabase.auth.admin.updateUserById(existingUser.id, {
        password: demoUser.password,
        email_confirm: true,
        user_metadata: {
          full_name: demoUser.fullName,
        },
      })
    : await supabase.auth.admin.createUser({
        email: demoUser.email,
        password: demoUser.password,
        email_confirm: true,
        user_metadata: {
          full_name: demoUser.fullName,
        },
      });

  if (authResult.error || !authResult.data.user) {
    throw new Error(authResult.error?.message || "User seed failed.");
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      user_id: authResult.data.user.id,
      email: demoUser.email,
      full_name: demoUser.fullName,
      role: demoUser.role,
    },
    {
      onConflict: "user_id",
    },
  );

  if (profileError) {
    throw new Error(profileError.message);
  }

  console.log(`${demoUser.role}: ${demoUser.email}`);
}
