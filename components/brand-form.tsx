"use client";

import { FormEvent, useState } from "react";
import { Loader2, WandSparkles } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { ResultCard } from "@/components/result-card";
import type { AppRole, BrandManualResponse } from "@/lib/types";

type BrandFormProps = {
  accessToken: string;
  onCreated?: () => void;
  role: AppRole;
};

async function readApiError(response: Response) {
  const data = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;

  return data?.error || `Request failed with status ${response.status}`;
}

export function BrandForm({ accessToken, onCreated, role }: BrandFormProps) {
  const [name, setName] = useState("");
  const [product, setProduct] = useState("");
  const [tone, setTone] = useState("");
  const [audience, setAudience] = useState("");
  const [restrictions, setRestrictions] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BrandManualResponse | null>(null);
  const canCreate = role === "creador";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canCreate) {
      setError("Solo el rol Creador puede generar manuales.");
      return;
    }

    setIsLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/brand/manual", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          product,
          tone,
          audience,
          restrictions,
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = (await response.json()) as BrandManualResponse;
      setResult(data);
      onCreated?.();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo generar el manual.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Brand Manual</CardTitle>
        <CardDescription>
          {canCreate
            ? "Genera y vectoriza una guia de marca."
            : "Disponible para Creador."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="brand-name">Marca</Label>
            <Input
              disabled={!canCreate}
              id="brand-name"
              onChange={(event) => setName(event.target.value)}
              placeholder="Content Suite"
              required
              value={name}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="brand-product">Producto</Label>
            <Input
              disabled={!canCreate}
              id="brand-product"
              onChange={(event) => setProduct(event.target.value)}
              placeholder="Plataforma IA para contenido de marca"
              required
              value={product}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="brand-tone">Tono</Label>
            <Input
              disabled={!canCreate}
              id="brand-tone"
              onChange={(event) => setTone(event.target.value)}
              placeholder="Profesional, claro, creativo"
              required
              value={tone}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="brand-audience">Publico objetivo</Label>
            <Input
              disabled={!canCreate}
              id="brand-audience"
              onChange={(event) => setAudience(event.target.value)}
              placeholder="Equipos de marketing y fundadores"
              required
              value={audience}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="brand-restrictions">Restricciones</Label>
            <Textarea
              disabled={!canCreate}
              id="brand-restrictions"
              onChange={(event) => setRestrictions(event.target.value)}
              placeholder="Evitar claims medicos, no usar tono agresivo"
              value={restrictions}
            />
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Button className="w-full" disabled={isLoading || !canCreate} type="submit">
            {isLoading ? (
              <Loader2 className="animate-spin" />
            ) : (
              <WandSparkles />
            )}
            {isLoading ? "Generando..." : "Generar manual"}
          </Button>
        </form>

        {result ? (
          <div className="mt-5">
            <ResultCard
              content={result.brand.manual_text}
              subtitle={`${result.chunks} chunks guardados en pgvector`}
              title={result.brand.name}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
