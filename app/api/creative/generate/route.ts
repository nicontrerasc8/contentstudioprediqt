import { NextResponse } from "next/server";
import { AuthError, getAuthStatus, requireAuth } from "@/lib/auth";
import {
  generateText,
  GROQ_TEXT_MODEL,
  parseJsonObject,
} from "@/lib/groq";
import {
  buildTracePayload,
  errorMessage,
  recordAiTrace,
  runObservedGeneration,
} from "@/lib/observability";
import {
  buildCreativeCompliancePrompt,
  buildCreativePrompt,
} from "@/lib/prompts";
import {
  formatBrandContext,
  getBrandOrThrow,
  getRelevantBrandMatches,
} from "@/lib/rag";
import {
  type CreativeComplianceResult,
  creativeContentTypes,
  type CreativeContentType,
  type CreativeGenerateRequest,
  type Database,
} from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function jsonError(error: unknown, status = 500) {
  const message =
    error instanceof Error ? error.message : "Unexpected server error.";

  return NextResponse.json({ error: message }, { status });
}

function isCreativeType(value: unknown): value is CreativeContentType {
  return (
    typeof value === "string" &&
    creativeContentTypes.includes(value as CreativeContentType)
  );
}

function parseCreativeRequest(body: unknown): CreativeGenerateRequest {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body.");
  }

  const payload = body as Record<string, unknown>;

  if (typeof payload.brandId !== "string" || !payload.brandId.trim()) {
    throw new Error("brandId is required.");
  }

  if (!isCreativeType(payload.type)) {
    throw new Error("Invalid content type.");
  }

  return {
    brandId: payload.brandId.trim(),
    type: payload.type,
  };
}

function normalizeIssues(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeComplianceResult(
  value: Partial<CreativeComplianceResult>,
  fallbackOutput: string,
): CreativeComplianceResult {
  const status = value.status === "rechazado" ? "rechazado" : "check";
  const revisedOutput =
    typeof value.revisedOutput === "string" && value.revisedOutput.trim()
      ? value.revisedOutput.trim()
      : fallbackOutput;

  return {
    status,
    issues: status === "check" ? [] : normalizeIssues(value.issues),
    revisedOutput,
  };
}

export async function POST(request: Request) {
  let input: CreativeGenerateRequest | null = null;
  let prompt = "";
  let supabaseForTrace: SupabaseClient<Database> | null = null;
  const startedAt = Date.now();

  try {
    const auth = await requireAuth(request, ["creador"]);
    supabaseForTrace = auth.supabase;
    input = parseCreativeRequest(await request.json());
    const brand = await getBrandOrThrow(input.brandId, auth.supabase);
    const matches = await getRelevantBrandMatches(
      auth.supabase,
      input.brandId,
      `${input.type} ${brand.name} ${brand.product} ${brand.audience}`,
    );
    const context = formatBrandContext(matches);

    if (!context.trim()) {
      throw new Error("No RAG context found for this brand.");
    }

    prompt = buildCreativePrompt({
      brand,
      type: input.type,
      context,
    });
    const observedGeneration = await runObservedGeneration(
      {
        name: "creative-engine.generate",
        model: GROQ_TEXT_MODEL,
        prompt,
        input: {
          ...input,
          ragMatches: matches.map((match) => ({
            id: match.id,
            similarity: match.similarity,
          })),
        },
        metadata: {
          module: "Creative Engine",
          contentType: input.type,
        },
        modelParameters: {
          temperature: 0.55,
        },
      },
      () =>
        generateText(prompt, {
          temperature: 0.55,
        }),
    );

    const compliancePrompt = buildCreativeCompliancePrompt({
      type: input.type,
      context,
      output: observedGeneration.result,
    });
    const observedCompliance = await runObservedGeneration(
      {
        name: "creative-engine.compliance",
        model: GROQ_TEXT_MODEL,
        prompt: compliancePrompt,
        input: {
          brandId: input.brandId,
          type: input.type,
        },
        metadata: {
          module: "Creative Engine",
          step: "post_generation_compliance",
        },
        modelParameters: {
          temperature: 0.1,
        },
      },
      () =>
        generateText(compliancePrompt, {
          format: "json",
          temperature: 0.1,
        }),
    );
    const compliance = normalizeComplianceResult(
      parseJsonObject<Partial<CreativeComplianceResult>>(
        observedCompliance.result,
      ),
      observedGeneration.result,
    );
    const output =
      compliance.status === "rechazado" && compliance.revisedOutput
        ? compliance.revisedOutput
        : observedGeneration.result;

    const supabase = auth.supabase;
    const { data: generation, error } = await supabase
      .from("content_generations")
      .insert({
        brand_id: input.brandId,
        created_by: auth.user.id,
        type: input.type,
        output,
        compliance_status: compliance.status,
        compliance_issues: compliance.issues,
        approval_status: "pendiente",
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    await recordAiTrace(
      buildTracePayload({
        operation: "creative_generation",
        brandId: input.brandId,
        itemType: "content_generation",
        itemId: generation.id,
        model: GROQ_TEXT_MODEL,
        prompt,
        ragContext: context,
        input: {
          brandId: input.brandId,
          type: input.type,
          ragMatches: matches.map((match) => ({
            id: match.id,
            similarity: match.similarity,
          })),
        },
        output: observedGeneration.result,
        durationMs: observedGeneration.durationMs,
        langfuseEnabled: observedGeneration.langfuseEnabled,
        langfuseTraceId: observedGeneration.langfuseTraceId,
        langfuseObservationId: observedGeneration.langfuseObservationId,
      }),
      supabase,
    );

    await recordAiTrace(
      buildTracePayload({
        operation: "creative_compliance",
        brandId: input.brandId,
        itemType: "content_generation",
        itemId: generation.id,
        model: GROQ_TEXT_MODEL,
        prompt: compliancePrompt,
        ragContext: context,
        input: {
          brandId: input.brandId,
          type: input.type,
        },
        output: observedCompliance.result,
        durationMs: observedCompliance.durationMs,
        langfuseEnabled: observedCompliance.langfuseEnabled,
        langfuseTraceId: observedCompliance.langfuseTraceId,
        langfuseObservationId: observedCompliance.langfuseObservationId,
        metadata: {
          complianceStatus: compliance.status,
          issues: compliance.issues,
        },
      }),
      supabase,
    );

    return NextResponse.json({
      generation,
      output,
      context,
      compliance,
    });
  } catch (error) {
    if (!(error instanceof AuthError)) {
      await recordAiTrace(
        buildTracePayload({
          operation: "creative_generation",
          brandId: input?.brandId ?? null,
          model: GROQ_TEXT_MODEL,
          prompt: prompt || "Prompt could not be built.",
          input,
          error: errorMessage(error),
          durationMs: Date.now() - startedAt,
        }),
        supabaseForTrace ?? undefined,
      );
    }

    return jsonError(error, getAuthStatus(error));
  }
}
