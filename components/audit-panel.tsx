"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { Select } from "@/components/ui/select";
import { ResultCard } from "@/components/result-card";
import type { AppRole, BrandSummary, ImageAuditResponse } from "@/lib/types";

type AuditPanelProps = {
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

export function AuditPanel({
  accessToken,
  onCreated,
  refreshKey,
  role,
}: AuditPanelProps) {
  const [brands, setBrands] = useState<BrandSummary[]>([]);
  const [brandId, setBrandId] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [isLoadingBrands, setIsLoadingBrands] = useState(true);
  const [isAuditing, setIsAuditing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImageAuditResponse | null>(null);
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
      setError("Solo el rol Creador puede auditar imagenes.");
      return;
    }

    if (!brandId || !image) {
      setError("Selecciona una marca y una imagen.");
      return;
    }

    const formData = new FormData();
    formData.append("brandId", brandId);
    formData.append("image", image);

    setIsAuditing(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/audit/image", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      setResult((await response.json()) as ImageAuditResponse);
      onCreated?.();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo auditar la imagen.",
      );
    } finally {
      setIsAuditing(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Audit Image</CardTitle>
            <CardDescription>
              {canCreate
                ? "Valida imagenes contra el manual."
                : "Disponible para Creador."}
            </CardDescription>
          </div>
          {result ? (
            <Badge
              variant={
                result.result.status === "check" ? "secondary" : "destructive"
              }
            >
              {result.result.score}/100
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="audit-brand">Marca</Label>
            <Select
              disabled={!canCreate || isLoadingBrands || !brands.length}
              id="audit-brand"
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
            <Label htmlFor="audit-image">Imagen</Label>
            <Input
              accept="image/*"
              disabled={!canCreate}
              id="audit-image"
              onChange={(event) => setImage(event.target.files?.[0] || null)}
              required
              type="file"
            />
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Button
            className="w-full"
            disabled={isAuditing || !canCreate}
            type="submit"
          >
            {isAuditing ? (
              <Loader2 className="animate-spin" />
            ) : (
              <ShieldCheck />
            )}
            {isAuditing ? "Auditando..." : "Auditar imagen"}
          </Button>
        </form>

        {result ? (
          <div className="mt-5">
            {result.imageUrl ? (
              <div className="mb-4 overflow-hidden rounded-md border border-border bg-muted/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={result.audit.image_name}
                  className="max-h-80 w-full object-contain"
                  src={result.imageUrl}
                />
              </div>
            ) : null}
            <ResultCard
              data={result.result}
              status={result.result.status === "check" ? "success" : "warning"}
              subtitle={`${result.audit.image_name} - ${result.audit.approval_status}`}
              title="Resultado de auditoria"
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
