import type { NodeSDK } from "@opentelemetry/sdk-node";
import type { LangfuseGenerationAttributes } from "@langfuse/tracing";
import type { AiTraceOperation, Database, Json } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type TraceInsert = Database["public"]["Tables"]["ai_traces"]["Insert"];

type ObservedGenerationInput = {
  name: string;
  model: string;
  prompt: string;
  input?: unknown;
  metadata?: Record<string, unknown>;
  modelParameters?: Record<string, string | number>;
};

type ObservedGenerationResult<T> = {
  result: T;
  durationMs: number;
  langfuseEnabled: boolean;
  langfuseTraceId: string | null;
  langfuseObservationId: string | null;
};

let langfuseSdk: NodeSDK | null = null;
let langfuseStartPromise: Promise<boolean> | null = null;

function hasLangfuseCredentials() {
  return Boolean(
    process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY,
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error";
}

export async function startLangfuseTelemetry() {
  if (!hasLangfuseCredentials()) {
    return false;
  }

  if (langfuseSdk) {
    return true;
  }

  langfuseStartPromise ??= (async () => {
    try {
      const [{ NodeSDK }, { LangfuseSpanProcessor }] = await Promise.all([
        import("@opentelemetry/sdk-node"),
        import("@langfuse/otel"),
      ]);

      langfuseSdk = new NodeSDK({
        spanProcessors: [new LangfuseSpanProcessor()],
      });

      langfuseSdk.start();
      return true;
    } catch (error) {
      console.error("Langfuse telemetry could not be started.", error);
      langfuseSdk = null;
      langfuseStartPromise = null;
      return false;
    }
  })();

  return langfuseStartPromise;
}

export async function shutdownLangfuseTelemetry() {
  if (!langfuseSdk) {
    return;
  }

  await langfuseSdk.shutdown();
  langfuseSdk = null;
  langfuseStartPromise = null;
}

export async function runObservedGeneration<T>(
  input: ObservedGenerationInput,
  run: () => Promise<T>,
): Promise<ObservedGenerationResult<T>> {
  const startedAt = Date.now();
  const langfuseEnabled = await startLangfuseTelemetry();

  if (!langfuseEnabled) {
    return {
      result: await run(),
      durationMs: Date.now() - startedAt,
      langfuseEnabled: false,
      langfuseTraceId: null,
      langfuseObservationId: null,
    };
  }

  const { getActiveSpanId, getActiveTraceId, startActiveObservation } =
    await import("@langfuse/tracing");

  let langfuseTraceId: string | null = null;
  let langfuseObservationId: string | null = null;

  return startActiveObservation(
    input.name,
    async (generation) => {
      langfuseTraceId = getActiveTraceId() || null;
      langfuseObservationId = getActiveSpanId() || null;

      generation.update({
        input: {
          request: input.input,
          prompt: input.prompt,
        },
        metadata: input.metadata,
        model: input.model,
        modelParameters: input.modelParameters,
      } satisfies LangfuseGenerationAttributes);

      try {
        const result = await run();
        generation.update({
          output: result,
        });

        return {
          result,
          durationMs: Date.now() - startedAt,
          langfuseEnabled: true,
          langfuseTraceId,
          langfuseObservationId,
        };
      } catch (error) {
        generation.update({
          level: "ERROR",
          statusMessage: getErrorMessage(error),
        });
        throw error;
      }
    },
    { asType: "generation" },
  );
}

export async function recordAiTrace(
  input: TraceInsert,
  supabase?: SupabaseClient<Database>,
) {
  try {
    if (!supabase) {
      return;
    }

    const { error } = await supabase.from("ai_traces").insert(input);

    if (error) {
      console.error("AI trace could not be stored.", error.message);
    }
  } catch (error) {
    console.error("AI trace could not be stored.", error);
  }
}

export function buildTracePayload(input: {
  operation: AiTraceOperation;
  brandId?: string | null;
  itemType?: string | null;
  itemId?: string | null;
  model: string;
  prompt: string;
  ragContext?: string | null;
  input?: unknown;
  output?: string | null;
  error?: string | null;
  durationMs: number;
  langfuseEnabled?: boolean;
  langfuseTraceId?: string | null;
  langfuseObservationId?: string | null;
  metadata?: unknown;
}): TraceInsert {
  return {
    operation: input.operation,
    brand_id: input.brandId ?? null,
    item_type: input.itemType ?? null,
    item_id: input.itemId ?? null,
    model: input.model,
    prompt: input.prompt,
    rag_context: input.ragContext ?? null,
    input: (input.input ?? {}) as Json,
    output: input.output ?? null,
    error: input.error ?? null,
    duration_ms: input.durationMs,
    langfuse_enabled: input.langfuseEnabled ?? false,
    langfuse_trace_id: input.langfuseTraceId ?? null,
    langfuse_observation_id: input.langfuseObservationId ?? null,
    metadata: (input.metadata ?? {}) as Json,
  };
}

export function errorMessage(error: unknown) {
  return getErrorMessage(error);
}
