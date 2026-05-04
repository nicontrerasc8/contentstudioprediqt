"use client";

import {
  FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { Loader2, LogIn } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

type AuthenticatedSession = {
  accessToken: string;
  email: string;
  profile: Profile;
  signOut: () => Promise<void>;
};

type AuthGateProps = {
  children: (session: AuthenticatedSession) => ReactNode;
};

export function AuthGate({ children }: AuthGateProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadProfile = useCallback(async (userId: string) => {
    const supabase = getSupabaseBrowserClient();
    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) {
      throw new Error(`No se pudo cargar el perfil: ${profileError.message}`);
    }

    if (!data) {
      throw new Error("El usuario no tiene perfil de acceso configurado.");
    }

    return data;
  }, []);

  useEffect(() => {
    let mounted = true;
    const supabase = getSupabaseBrowserClient();

    async function initializeSession() {
      let nextSession: Session | null = null;
      setIsLoading(true);
      setError("");

      try {
        const { data, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          throw new Error(sessionError.message);
        }

        if (!mounted) {
          return;
        }

        nextSession = data.session;
        setSession(nextSession);
        if (!nextSession) {
          setProfile(null);
        }
      } catch (requestError) {
        if (mounted) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "No se pudo cargar la sesion.",
          );
        }
      } finally {
        if (mounted && !nextSession) {
          setIsLoading(false);
        }
      }
    }

    initializeSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setError("");

        if (!nextSession) {
          setProfile(null);
        }
      },
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id;

  useEffect(() => {
    let mounted = true;

    async function loadCurrentProfile() {
      if (!userId) {
        setProfile(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        const nextProfile = await loadProfile(userId);

        if (mounted) {
          setProfile(nextProfile);
        }
      } catch (requestError) {
        if (mounted) {
          setProfile(null);
          setError(
            requestError instanceof Error
              ? requestError.message
              : "No se pudo cargar el perfil.",
          );
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadCurrentProfile();

    return () => {
      mounted = false;
    };
  }, [loadProfile, userId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (signInError) {
        throw new Error(signInError.message);
      }

      if (!data.session) {
        throw new Error("No se pudo iniciar sesion.");
      }

      setSession(data.session);
      setProfile(await loadProfile(data.session.user.id));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo iniciar sesion.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }

  if (isLoading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-4 text-foreground">
        <Loader2 className="animate-spin" />
      </main>
    );
  }

  if (!session || !profile) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-4 text-foreground">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Content Suite</CardTitle>
            <CardDescription>Acceso privado</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  autoComplete="email"
                  id="email"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  autoComplete="current-password"
                  id="password"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </div>

              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <Button className="w-full" disabled={isSubmitting} type="submit">
                {isSubmitting ? <Loader2 className="animate-spin" /> : <LogIn />}
                Ingresar
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    );
  }

  return children({
    accessToken: session.access_token,
    email: session.user.email || profile.email,
    profile,
    signOut,
  });
}
