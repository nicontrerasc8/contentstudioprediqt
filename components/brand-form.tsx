"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  WandSparkles,
} from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { ResultCard } from "@/components/result-card";
import type { BrandManualResponse, BrandSummary } from "@/lib/types";

type BrandFormProps = {
  accessToken: string;
  onCreated?: () => void;
  refreshKey?: number;
};

type FormMode = "create" | "edit";

type BrandFormState = {
  name: string;
  product: string;
  tone: string;
  audience: string;
  restrictions: string;
};

const emptyForm: BrandFormState = {
  name: "",
  product: "",
  tone: "",
  audience: "",
  restrictions: "",
};

async function readApiError(response: Response) {
  const data = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;

  return data?.error || `Request failed with status ${response.status}`;
}

function toFormState(brand: BrandSummary): BrandFormState {
  return {
    name: brand.name,
    product: brand.product,
    tone: brand.tone,
    audience: brand.audience,
    restrictions: brand.restrictions || "",
  };
}

export function BrandForm({
  accessToken,
  onCreated,
  refreshKey = 0,
}: BrandFormProps) {
  const [brands, setBrands] = useState<BrandSummary[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [mode, setMode] = useState<FormMode>("create");
  const [form, setForm] = useState<BrandFormState>(emptyForm);
  const [isLoadingBrands, setIsLoadingBrands] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BrandManualResponse | null>(null);

  const selectedBrand = useMemo(
    () => brands.find((brand) => brand.id === selectedBrandId) || null,
    [brands, selectedBrandId],
  );

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
      setBrands(data.brands);

      if (mode === "edit") {
        const current = data.brands.find((brand) => brand.id === selectedBrandId);

        if (current) {
          setForm(toFormState(current));
        } else {
          setMode("create");
          setSelectedBrandId("");
          setForm(emptyForm);
        }
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudieron cargar las marcas.",
      );
    } finally {
      setIsLoadingBrands(false);
    }
  }

  useEffect(() => {
    loadBrands();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, refreshKey]);

  function updateField(field: keyof BrandFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startCreate() {
    setMode("create");
    setSelectedBrandId("");
    setForm(emptyForm);
    setResult(null);
    setError("");
  }

  function startEdit(brand: BrandSummary) {
    setMode("edit");
    setSelectedBrandId(brand.id);
    setForm(toFormState(brand));
    setResult(null);
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/brand/manual", {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(mode === "edit" ? { id: selectedBrandId } : {}),
          ...form,
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = (await response.json()) as BrandManualResponse;
      setResult(data);
      setMode("edit");
      setSelectedBrandId(data.brand.id);
      setForm(toFormState(data.brand));
      await loadBrands();
      onCreated?.();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo guardar la marca.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedBrand) {
      return;
    }

    const confirmed = window.confirm(
      `Eliminar ${selectedBrand.name}? Tambien se eliminaran sus embeddings, generaciones, auditorias y revisiones asociadas.`,
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(
        `/api/brand/manual?id=${encodeURIComponent(selectedBrand.id)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      startCreate();
      await loadBrands();
      onCreated?.();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo eliminar la marca.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>CRUD de marcas</CardTitle>
            <CardDescription>
              Genera, edita, vectoriza y administra guias de marca.
            </CardDescription>
          </div>
          <Button onClick={startCreate} size="sm" type="button" variant="outline">
            <Plus />
            Nueva marca
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium">Marcas</h3>
              <Badge variant="secondary">{brands.length}</Badge>
            </div>

            <div className="max-h-[460px] space-y-2 overflow-auto pr-1">
              {isLoadingBrands ? (
                <div className="flex items-center gap-2 rounded-md border border-border p-3 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Cargando marcas...
                </div>
              ) : null}

              {!isLoadingBrands && !brands.length ? (
                <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Aun no hay marcas guardadas.
                </div>
              ) : null}

              {brands.map((brand) => (
                <button
                  className={`w-full rounded-md border p-3 text-left transition-colors ${
                    selectedBrandId === brand.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-accent"
                  }`}
                  key={brand.id}
                  onClick={() => startEdit(brand)}
                  type="button"
                >
                  <span className="block text-sm font-medium">{brand.name}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {brand.product}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium">
                  {mode === "edit" ? "Editar marca" : "Crear marca"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {mode === "edit"
                    ? "Guardar regenera el manual y reemplaza los embeddings."
                    : "El manual se guarda y queda listo para RAG."}
                </p>
              </div>
              {mode === "edit" ? (
                <Badge variant="secondary">
                  <Pencil className="mr-1 size-3" />
                  Editando
                </Badge>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="brand-name">Marca</Label>
              <Input
                id="brand-name"
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Alicorp"
                required
                value={form.name}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="brand-product">Producto</Label>
              <Input
                id="brand-product"
                onChange={(event) => updateField("product", event.target.value)}
                placeholder="Portafolio de alimentos y consumo masivo"
                required
                value={form.product}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="brand-tone">Tono</Label>
              <Input
                id="brand-tone"
                onChange={(event) => updateField("tone", event.target.value)}
                placeholder="Cercano, confiable, familiar"
                required
                value={form.tone}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="brand-audience">Publico objetivo</Label>
              <Input
                id="brand-audience"
                onChange={(event) => updateField("audience", event.target.value)}
                placeholder="Familias, compradores del hogar y negocios"
                required
                value={form.audience}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="brand-restrictions">Restricciones</Label>
              <Textarea
                id="brand-restrictions"
                onChange={(event) =>
                  updateField("restrictions", event.target.value)
                }
                placeholder="Evitar promesas absolutas, claims medicos o tono agresivo"
                value={form.restrictions}
              />
            </div>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Button className="w-full" disabled={isSaving} type="submit">
                {isSaving ? (
                  <Loader2 className="animate-spin" />
                ) : mode === "edit" ? (
                  <Save />
                ) : (
                  <WandSparkles />
                )}
                {isSaving
                  ? "Guardando..."
                  : mode === "edit"
                    ? "Guardar y regenerar"
                    : "Generar manual"}
              </Button>

              <Button
                disabled={mode !== "edit" || isDeleting}
                onClick={handleDelete}
                type="button"
                variant="destructive"
              >
                {isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
                Eliminar
              </Button>
            </div>
          </form>
        </div>

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
