import { NextResponse } from "next/server";
import { chunkText, embedChunks } from "@/lib/embeddings";
import { generateText, GROQ_TEXT_MODEL } from "@/lib/groq";
import {
  AuthError,
  getAuthStatus,
  requireAuth,
} from "@/lib/auth";
import {
  buildTracePayload,
  errorMessage,
  recordAiTrace,
  runObservedGeneration,
} from "@/lib/observability";
import { buildBrandManualPrompt } from "@/lib/prompts";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { BrandManualRequest } from "@/lib/types";

export const runtime = "nodejs";

function jsonError(error: unknown, status = 500) {
  const message =
    error instanceof Error ? error.message : "Unexpected server error.";

  return NextResponse.json({ error: message }, { status });
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required.`);
  }

  return value.trim();
}

function parseManualRequest(body: unknown): BrandManualRequest {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body.");
  }

  const payload = body as Record<string, unknown>;

  return {
    name: requiredString(payload.name, "name"),
    product: requiredString(payload.product, "product"),
    tone: requiredString(payload.tone, "tone"),
    audience: requiredString(payload.audience, "audience"),
    restrictions:
      typeof payload.restrictions === "string"
        ? payload.restrictions.trim()
        : "",
  };
}

export async function GET(request: Request) {
  try {
    await requireAuth(request);
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("brands")
      .select("id,created_by,name,product,tone,audience,restrictions,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ brands: data || [] });
  } catch (error) {
    return jsonError(error, getAuthStatus(error));
  }
}

export async function POST(request: Request) {
  let input: BrandManualRequest | null = null;
  let prompt = "";
  const startedAt = Date.now();

  try {
    const auth = await requireAuth(request, ["creador"]);
    input = parseManualRequest(await request.json());
    prompt = buildBrandManualPrompt(input);
    const observedManual = await runObservedGeneration(
      {
        name: "brand-dna.manual",
        model: GROQ_TEXT_MODEL,
        prompt,
        input,
        metadata: {
          module: "Brand DNA Architect",
        },
        modelParameters: {
          temperature: 0.4,
        },
      },
      () => generateText(prompt, { temperature: 0.4 }),
    );
    const manualText = observedManual.result;

    const supabase = getSupabaseAdminClient();
    const { data: brand, error: brandError } = await supabase
      .from("brands")
      .insert({
        created_by: auth.user.id,
        name: input.name,
        product: input.product,
        tone: input.tone,
        audience: input.audience,
        restrictions: input.restrictions || null,
        manual_text: manualText,
      })
      .select("*")
      .single();

    if (brandError) {
      throw new Error(brandError.message);
    }

    const chunks = chunkText(manualText);

    if (!chunks.length) {
      throw new Error("The generated manual is empty.");
    }

    const embeddings = await embedChunks(chunks);
    const rows = chunks.map((chunk, index) => ({
      brand_id: brand.id,
      chunk,
      embedding: embeddings[index],
    }));

    const { error: embeddingsError } = await supabase
      .from("brand_embeddings")
      .insert(rows);

    if (embeddingsError) {
      throw new Error(embeddingsError.message);
    }

    await recordAiTrace(
      buildTracePayload({
        operation: "brand_manual",
        brandId: brand.id,
        itemType: "brand",
        itemId: brand.id,
        model: GROQ_TEXT_MODEL,
        prompt,
        input,
        output: manualText,
        durationMs: observedManual.durationMs,
        langfuseEnabled: observedManual.langfuseEnabled,
        langfuseTraceId: observedManual.langfuseTraceId,
        langfuseObservationId: observedManual.langfuseObservationId,
        metadata: {
          chunks: chunks.length,
        },
      }),
    );

    return NextResponse.json({ brand, chunks: chunks.length });
  } catch (error) {
    if (!(error instanceof AuthError)) {
      await recordAiTrace(
        buildTracePayload({
          operation: "brand_manual",
          model: GROQ_TEXT_MODEL,
          prompt: prompt || "Prompt could not be built.",
          input,
          error: errorMessage(error),
          durationMs: Date.now() - startedAt,
        }),
      );
    }

    return jsonError(error, getAuthStatus(error));
  }
}
