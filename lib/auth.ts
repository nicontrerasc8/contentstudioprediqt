import type { User } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { AppRole, Profile } from "@/lib/types";

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export type AuthContext = {
  user: User;
  profile: Profile;
  token: string;
};

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme.toLowerCase() !== "bearer" || !token) {
    throw new AuthError("Inicia sesion para continuar.", 401);
  }

  return token.trim();
}

export async function requireAuth(
  request: Request,
  allowedRoles?: AppRole[],
): Promise<AuthContext> {
  const token = getBearerToken(request);
  const supabase = getSupabaseAdminClient();
  const { data: userData, error: userError } =
    await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    throw new AuthError("Sesion invalida o expirada.", 401);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userData.user.id)
    .single();

  if (profileError || !profile) {
    throw new AuthError("El usuario no tiene un perfil de acceso.", 403);
  }

  if (allowedRoles?.length && !allowedRoles.includes(profile.role)) {
    throw new AuthError("No tienes permisos para esta accion.", 403);
  }

  return {
    user: userData.user,
    profile,
    token,
  };
}

export function getAuthStatus(error: unknown) {
  return error instanceof AuthError ? error.status : 500;
}
