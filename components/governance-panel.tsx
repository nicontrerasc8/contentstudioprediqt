"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, RefreshCw, ShieldCheck, X } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  AppRole,
  ApprovalStatus,
  GovernanceItem,
} from "@/lib/types";

type GovernancePanelProps = {
  accessToken: string;
  refreshKey: number;
  role: AppRole;
};

async function readApiError(response: Response) {
  const data = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;

  return data?.error || `Request failed with status ${response.status}`;
}

function statusVariant(status: string) {
  return status === "rechazado" ? "destructive" : "secondary";
}

function approvalLabel(status: ApprovalStatus) {
  if (status === "aprobado") {
    return "Aprobado";
  }

  if (status === "rechazado") {
    return "Rechazado";
  }

  return "Pendiente";
}

function roleLabel(role: AppRole) {
  if (role === "aprobador_a") {
    return "Aprobador A";
  }

  if (role === "aprobador_b") {
    return "Aprobador B";
  }

  return "Creador";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function GovernancePanel({
  accessToken,
  refreshKey,
  role,
}: GovernancePanelProps) {
  const [items, setItems] = useState<GovernanceItem[]>([]);
  const [reviewNote, setReviewNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [error, setError] = useState("");

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/governance/items", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = (await response.json()) as { items: GovernanceItem[] };
      setItems(data.items);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo cargar governance.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadItems();
  }, [loadItems, refreshKey]);

  async function updateApproval(
    item: GovernanceItem,
    approvalStatus: ApprovalStatus,
  ) {
    setUpdatingId(item.id);
    setError("");

    try {
      const response = await fetch("/api/governance/items", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: item.id,
          itemType: item.itemType,
          approvalStatus,
          reviewNote,
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      setReviewNote("");
      await loadItems();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo actualizar la aprobacion.",
      );
    } finally {
      setUpdatingId("");
    }
  }

  const canWriteReview = role === "aprobador_a" || role === "aprobador_b";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Governance</CardTitle>
            <CardDescription>Flujo de aprobacion y rechazo.</CardDescription>
          </div>
          <Button
            aria-label="Recargar governance"
            disabled={isLoading}
            onClick={loadItems}
            size="icon"
            type="button"
            variant="outline"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[180px_1fr]">
          <div className="grid content-start gap-2">
            <Label>Rol activo</Label>
            <Badge variant="secondary">{roleLabel(role)}</Badge>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="review-note">Nota</Label>
            <Textarea
              disabled={!canWriteReview}
              id="review-note"
              onChange={(event) => setReviewNote(event.target.value)}
              placeholder="Comentario de revision"
              value={reviewNote}
            />
          </div>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-3">
          {items.length ? (
            items.map((item) => {
              const isUpdating = updatingId === item.id;
              const finalClosed = item.approvalStatus !== "pendiente";
              const isApproverA = role === "aprobador_a";
              const isApproverB = role === "aprobador_b";
              const canReviewItem =
                !finalClosed &&
                (isApproverA ||
                  (isApproverB && item.reviewAStatus === "aprobado"));
              const waitsForA =
                !finalClosed &&
                isApproverB &&
                item.reviewAStatus !== "aprobado";

              return (
                <div
                  className="rounded-md border border-border bg-muted/30 p-4"
                  key={`${item.itemType}-${item.id}`}
                >
                  <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{item.brandName}</Badge>
                        <Badge variant="secondary">
                          {item.itemType === "content"
                            ? "Contenido"
                            : "Auditoria visual"}
                        </Badge>
                        <Badge variant={statusVariant(item.approvalStatus)}>
                          {approvalLabel(item.approvalStatus)}
                        </Badge>
                        <Badge variant={statusVariant(item.reviewAStatus)}>
                          A: {approvalLabel(item.reviewAStatus)}
                        </Badge>
                        <Badge variant={statusVariant(item.reviewBStatus)}>
                          B: {approvalLabel(item.reviewBStatus)}
                        </Badge>
                        {item.aiStatus ? (
                          <Badge variant={statusVariant(item.aiStatus)}>
                            IA: {item.aiStatus}
                            {typeof item.score === "number"
                              ? ` ${item.score}/100`
                              : ""}
                          </Badge>
                        ) : null}
                      </div>
                      <h4 className="mt-3 text-sm font-semibold text-foreground">
                        {item.title}
                      </h4>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(item.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        disabled={!canReviewItem || isUpdating}
                        onClick={() => updateApproval(item, "aprobado")}
                        size="sm"
                        type="button"
                      >
                        {isUpdating ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Check />
                        )}
                        Aprobar
                      </Button>
                      <Button
                        disabled={!canReviewItem || isUpdating}
                        onClick={() => updateApproval(item, "rechazado")}
                        size="sm"
                        type="button"
                        variant="destructive"
                      >
                        {isUpdating ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <X />
                        )}
                        Rechazar
                      </Button>
                    </div>
                  </div>

                  {waitsForA ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Pendiente de revision de Aprobador A.
                    </p>
                  ) : null}

                  {item.issues?.length ? (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {item.issues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  ) : null}

                  {item.imageUrl ? (
                    <div className="mt-3 overflow-hidden rounded-md border border-border bg-background">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt={item.title}
                        className="max-h-80 w-full object-contain"
                        src={item.imageUrl}
                      />
                      <div className="flex flex-wrap items-center gap-2 border-t border-border p-3 text-xs text-muted-foreground">
                        <span>{item.imageMimeType || "image"}</span>
                        {typeof item.imageSizeBytes === "number" ? (
                          <span>
                            {(item.imageSizeBytes / 1024 / 1024).toFixed(2)} MB
                          </span>
                        ) : null}
                        {item.imageStoragePath ? (
                          <span className="truncate">{item.imageStoragePath}</span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-background p-3 text-sm leading-relaxed text-foreground">
                    {item.body}
                  </pre>

                  {item.reviewedAt ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <ShieldCheck className="size-4" />
                      <span>{item.reviewedBy}</span>
                      <span>{formatDate(item.reviewedAt)}</span>
                      {item.reviewNote ? <span>{item.reviewNote}</span> : null}
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {isLoading ? "Cargando..." : "Sin piezas para revisar."}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
