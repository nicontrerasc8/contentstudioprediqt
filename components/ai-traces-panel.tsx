"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Loader2, RefreshCw } from "lucide-react";
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
import { Select } from "@/components/ui/select";
import type { AiTrace, AiTraceOperation } from "@/lib/types";

type AiTracesPanelProps = {
  accessToken: string;
  refreshKey: number;
};

const operations: Array<AiTraceOperation | ""> = [
  "",
  "brand_manual",
  "creative_generation",
  "creative_compliance",
  "image_audit",
];

async function readApiError(response: Response) {
  const data = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;

  return data?.error || `Request failed with status ${response.status}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function operationLabel(operation: AiTraceOperation | "") {
  if (!operation) {
    return "Todas";
  }

  if (operation === "brand_manual") {
    return "Brand Manual";
  }

  if (operation === "creative_generation") {
    return "Creative";
  }

  if (operation === "creative_compliance") {
    return "Compliance";
  }

  return "Image Audit";
}

export function AiTracesPanel({ accessToken, refreshKey }: AiTracesPanelProps) {
  const [traces, setTraces] = useState<AiTrace[]>([]);
  const [operation, setOperation] = useState<AiTraceOperation | "">("");
  const [expandedId, setExpandedId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadTraces = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ limit: "25" });

      if (operation) {
        params.set("operation", operation);
      }

      const response = await fetch(`/api/observability/traces?${params}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = (await response.json()) as { traces: AiTrace[] };
      setTraces(data.traces);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudieron cargar las trazas.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, operation]);

  useEffect(() => {
    loadTraces();
  }, [loadTraces, refreshKey]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>AI Traces</CardTitle>
            <CardDescription>
              Logs de prompts, modelos, contexto, salidas, errores y latencia.
            </CardDescription>
          </div>
          <Button
            aria-label="Recargar trazas"
            disabled={isLoading}
            onClick={loadTraces}
            size="icon"
            type="button"
            variant="outline"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:max-w-xs">
          <Label htmlFor="trace-operation">Operacion</Label>
          <Select
            id="trace-operation"
            onChange={(event) =>
              setOperation(event.target.value as AiTraceOperation | "")
            }
            value={operation}
          >
            {operations.map((item) => (
              <option key={item || "all"} value={item}>
                {operationLabel(item)}
              </option>
            ))}
          </Select>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-3">
          {traces.length ? (
            traces.map((trace) => {
              const isExpanded = expandedId === trace.id;

              return (
                <div
                  className="rounded-md border border-border bg-muted/30 p-4"
                  key={trace.id}
                >
                  <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={trace.error ? "destructive" : "secondary"}>
                          {trace.error ? "error" : "ok"}
                        </Badge>
                        <Badge variant="outline">{operationLabel(trace.operation)}</Badge>
                        <Badge variant="secondary">{trace.model}</Badge>
                        <Badge variant="secondary">
                          <Clock className="mr-1 size-3" />
                          {trace.duration_ms}ms
                        </Badge>
                        {trace.langfuse_enabled ? (
                          <Badge variant="secondary">Langfuse</Badge>
                        ) : null}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatDate(trace.created_at)}
                      </p>
                    </div>
                    <Button
                      onClick={() =>
                        setExpandedId((current) =>
                          current === trace.id ? "" : trace.id,
                        )
                      }
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {isExpanded ? "Ocultar" : "Ver detalle"}
                    </Button>
                  </div>

                  {trace.error ? (
                    <Alert className="mt-3" variant="destructive">
                      <AlertDescription>{trace.error}</AlertDescription>
                    </Alert>
                  ) : null}

                  <pre className="mt-3 max-h-32 overflow-auto whitespace-pre-wrap rounded-md bg-background p-3 text-xs leading-relaxed text-foreground">
                    {trace.prompt}
                  </pre>

                  {isExpanded ? (
                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      <div>
                        <h4 className="mb-2 text-xs font-medium text-muted-foreground">
                          Input
                        </h4>
                        <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-background p-3 text-xs leading-relaxed text-foreground">
                          {formatJson(trace.input)}
                        </pre>
                      </div>
                      <div>
                        <h4 className="mb-2 text-xs font-medium text-muted-foreground">
                          Output
                        </h4>
                        <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-background p-3 text-xs leading-relaxed text-foreground">
                          {trace.output || "Sin output"}
                        </pre>
                      </div>
                      <div>
                        <h4 className="mb-2 text-xs font-medium text-muted-foreground">
                          Contexto RAG / Manual
                        </h4>
                        <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-background p-3 text-xs leading-relaxed text-foreground">
                          {trace.rag_context || "Sin contexto"}
                        </pre>
                      </div>
                      <div>
                        <h4 className="mb-2 text-xs font-medium text-muted-foreground">
                          Metadata
                        </h4>
                        <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-background p-3 text-xs leading-relaxed text-foreground">
                          {formatJson({
                            itemType: trace.item_type,
                            itemId: trace.item_id,
                            brandId: trace.brand_id,
                            langfuseTraceId: trace.langfuse_trace_id,
                            langfuseObservationId: trace.langfuse_observation_id,
                            metadata: trace.metadata,
                          })}
                        </pre>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {isLoading ? "Cargando trazas..." : "Aun no hay trazas de IA."}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
