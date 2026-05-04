"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AuthGate } from "@/components/auth-gate";
import { AuditPanel } from "@/components/audit-panel";
import { BrandForm } from "@/components/brand-form";
import { CreativePanel } from "@/components/creative-panel";
import { GovernancePanel } from "@/components/governance-panel";
import type { AppRole } from "@/lib/types";

function roleLabel(role: AppRole) {
  if (role === "aprobador_a") {
    return "Aprobador A";
  }

  if (role === "aprobador_b") {
    return "Aprobador B";
  }

  return "Creador";
}

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshWorkspace = () => setRefreshKey((value) => value + 1);

  return (
    <AuthGate>
      {({ accessToken, profile, signOut }) => (
        <main className="min-h-dvh bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
            <header className="flex flex-col justify-between gap-4 border-b border-border pb-6 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-medium uppercase tracking-normal text-muted-foreground">
                  Content Suite
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-normal md:text-4xl">
                  Manuales, contenido y auditoria IA
                </h1>
              </div>
              <div className="flex flex-wrap gap-2">
              
                <Badge variant="secondary">{roleLabel(profile.role)}</Badge>
                <Button
                  aria-label="Cerrar sesion"
                  onClick={signOut}
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  <LogOut />
                </Button>
              </div>
            </header>

            <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <BrandForm
                accessToken={accessToken}
                onCreated={refreshWorkspace}
                refreshKey={refreshKey}
              />
              <div className="grid gap-6">
                <CreativePanel
                  accessToken={accessToken}
                  onCreated={refreshWorkspace}
                  refreshKey={refreshKey}
                  role={profile.role}
                />
                <AuditPanel
                  accessToken={accessToken}
                  onCreated={refreshWorkspace}
                  refreshKey={refreshKey}
                  role={profile.role}
                />
              </div>
            </section>

            <GovernancePanel
              accessToken={accessToken}
              refreshKey={refreshKey}
              role={profile.role}
            />
          </div>
        </main>
      )}
    </AuthGate>
  );
}
