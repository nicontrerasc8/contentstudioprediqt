"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ResultCard } from "@/components/result-card";
import {
  creativeContentTypes,
  type AppRole,
  type BrandSummary,
  type CreativeContentType,
  type CreativeGenerateResponse,
} from "@/lib/types";

type CreativePanelProps = {
  accessToken: string;
  onCreated?: () => void;
  refreshKey: number;
  role: AppRole;
};

async function readApiError(response: Response) {
  const data = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;

  return data?.error || `Request failed with status ${response.status}`;
}

export function CreativePanel({
  accessToken,
  onCreated,
  refreshKey,
  role,
}: CreativePanelProps) {
  const [brands, setBrands] = useState<BrandSummary[]>([]);
  const [brandId, setBrandId] = useState("");
  const [type, setType] = useState<CreativeContentType>(
    creativeContentTypes[0],
  );
  const [isLoadingBrands, setIsLoadingBrands] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CreativeGenerateResponse | null>(null);
  const canCreate = role === "creador";

  useEffect(() => {
    let mounted = true;

    async function loadBrands() {
      setIsLoadingBrands(true);
      setError("");

      try {
        const response = await fetch("/api/brand/manual", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error(await readApiError(response));
        }

        const data = (await response.json()) as { brands: BrandSummary[] };

        if (!mounted) {
          return;
        }

        setBrands(data.brands);
        setBrandId((current) => current || data.brands[0]?.id || "");
      } catch (requestError) {
        if (mounted) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "No se pudieron cargar las marcas.",
          );
        }
      } finally {
        if (mounted) {
          setIsLoadingBrands(false);
        }
      }
    }

    loadBrands();

    return () => {
      mounted = false;
    };
  }, [accessToken, refreshKey]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canCreate) {
      setError("Solo el rol Creador puede generar contenido.");
      return;
    }

    if (!brandId) {
      setError("Crea una marca antes de generar contenido.");
      return;
    }

    setIsGenerating(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/creative/generate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          brandId,
          type,
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      setResult((await response.json()) as CreativeGenerateResponse);
      onCreated?.();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo generar el contenido.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Creative Engine</CardTitle>
        <CardDescription>
          {canCreate
            ? "Genera contenido con contexto RAG."
            : "Disponible para Creador."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="creative-brand">Marca</Label>
            <Select
              disabled={!canCreate || isLoadingBrands || !brands.length}
              id="creative-brand"
              onChange={(event) => setBrandId(event.target.value)}
              value={brandId}
            >
              <option value="">
                {isLoadingBrands ? "Cargando..." : "Selecciona una marca"}
              </option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="creative-type">Tipo de contenido</Label>
            <Select
              disabled={!canCreate}
              id="creative-type"
              onChange={(event) =>
                setType(event.target.value as CreativeContentType)
              }
              value={type}
            >
              {creativeContentTypes.map((contentType) => (
                <option key={contentType} value={contentType}>
                  {contentType}
                </option>
              ))}
            </Select>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Button
            className="w-full"
            disabled={isGenerating || !canCreate}
            type="submit"
          >
            {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {isGenerating ? "Generando..." : "Generar contenido"}
          </Button>
        </form>

        {result ? (
          <div className="mt-5">
            <ResultCard
              content={result.output}
              subtitle={`${result.generation.type} - compliance ${result.compliance.status}`}
              title="Contenido generado"
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
