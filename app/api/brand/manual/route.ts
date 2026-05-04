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
import { AUDIT_FILES_BUCKET } from "@/lib/storage";
import type { BrandManualRequest, Database } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

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

function requiredId(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("brandId is required.");
  }

  return value.trim();
}

async function generateManual(input: BrandManualRequest) {
  const prompt = buildBrandManualPrompt(input);
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

  return {
    prompt,
    manualText: observedManual.result,
    observedManual,
  };
}

async function replaceBrandEmbeddings(
  supabase: SupabaseClient<Database>,
  brandId: string,
  manualText: string,
) {
  const chunks = chunkText(manualText);

  if (!chunks.length) {
    throw new Error("The generated manual is empty.");
  }

  const embeddings = await embedChunks(chunks);
  const rows = chunks.map((chunk, index) => ({
    brand_id: brandId,
    chunk,
    embedding: embeddings[index],
  }));
  const { error: deleteError } = await supabase
    .from("brand_embeddings")
    .delete()
    .eq("brand_id", brandId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const { error: embeddingsError } = await supabase
    .from("brand_embeddings")
    .insert(rows);

  if (embeddingsError) {
    throw new Error(embeddingsError.message);
  }

  return chunks.length;
}

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    const supabase = auth.supabase;
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
  let supabaseForTrace: SupabaseClient<Database> | null = null;
  const startedAt = Date.now();

  try {
    const auth = await requireAuth(request);
    supabaseForTrace = auth.supabase;
    input = parseManualRequest(await request.json());
    const generated = await generateManual(input);
    prompt = generated.prompt;

    const supabase = auth.supabase;
    const { data: brand, error: brandError } = await supabase
      .from("brands")
      .insert({
        created_by: auth.user.id,
        name: input.name,
        product: input.product,
        tone: input.tone,
        audience: input.audience,
        restrictions: input.restrictions || null,
        manual_text: generated.manualText,
      })
      .select("*")
      .single();

    if (brandError) {
      throw new Error(brandError.message);
    }

    const chunks = await replaceBrandEmbeddings(
      supabase,
      brand.id,
      generated.manualText,
    );

    await recordAiTrace(
      buildTracePayload({
        operation: "brand_manual",
        brandId: brand.id,
        itemType: "brand",
        itemId: brand.id,
        model: GROQ_TEXT_MODEL,
        prompt,
        input,
        output: generated.manualText,
        durationMs: generated.observedManual.durationMs,
        langfuseEnabled: generated.observedManual.langfuseEnabled,
        langfuseTraceId: generated.observedManual.langfuseTraceId,
        langfuseObservationId: generated.observedManual.langfuseObservationId,
        metadata: {
          chunks,
        },
      }),
      supabase,
    );

    return NextResponse.json({ brand, chunks });
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
        supabaseForTrace ?? undefined,
      );
    }

    return jsonError(error, getAuthStatus(error));
  }
}

export async function PATCH(request: Request) {
  let input: BrandManualRequest | null = null;
  let brandId: string | null = null;
  let prompt = "";
  let supabaseForTrace: SupabaseClient<Database> | null = null;
  const startedAt = Date.now();

  try {
    const auth = await requireAuth(request);
    supabaseForTrace = auth.supabase;
    const body = await request.json();
    brandId = requiredId((body as Record<string, unknown>).id);
    input = parseManualRequest(body);
    const generated = await generateManual(input);
    prompt = generated.prompt;

    const supabase = auth.supabase;
    const { data: brand, error: brandError } = await supabase
      .from("brands")
      .update({
        name: input.name,
        product: input.product,
        tone: input.tone,
        audience: input.audience,
        restrictions: input.restrictions || null,
        manual_text: generated.manualText,
      })
      .eq("id", brandId)
      .select("*")
      .single();

    if (brandError) {
      throw new Error(brandError.message);
    }

    const chunks = await replaceBrandEmbeddings(
      supabase,
      brand.id,
      generated.manualText,
    );

    await recordAiTrace(
      buildTracePayload({
        operation: "brand_manual",
        brandId: brand.id,
        itemType: "brand",
        itemId: brand.id,
        model: GROQ_TEXT_MODEL,
        prompt,
        input,
        output: generated.manualText,
        durationMs: generated.observedManual.durationMs,
        langfuseEnabled: generated.observedManual.langfuseEnabled,
        langfuseTraceId: generated.observedManual.langfuseTraceId,
        langfuseObservationId: generated.observedManual.langfuseObservationId,
        metadata: {
          action: "update",
          chunks,
        },
      }),
      supabase,
    );

    return NextResponse.json({ brand, chunks });
  } catch (error) {
    if (!(error instanceof AuthError)) {
      await recordAiTrace(
        buildTracePayload({
          operation: "brand_manual",
          brandId,
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

export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const brandId = requiredId(searchParams.get("id"));
    const supabase = auth.supabase;
    const [{ data: generations }, { data: audits }] = await Promise.all([
      supabase.from("content_generations").select("id").eq("brand_id", brandId),
      supabase
        .from("image_audits")
        .select("id,image_storage_path")
        .eq("brand_id", brandId),
    ]);
    const generationIds = (generations || []).map((item) => item.id);
    const auditIds = (audits || []).map((item) => item.id);

    if (generationIds.length) {
      const { error } = await supabase
        .from("approval_reviews")
        .delete()
        .eq("item_type", "content")
        .in("item_id", generationIds);

      if (error) {
        throw new Error(error.message);
      }
    }

    if (auditIds.length) {
      const { error } = await supabase
        .from("approval_reviews")
        .delete()
        .eq("item_type", "image_audit")
        .in("item_id", auditIds);

      if (error) {
        throw new Error(error.message);
      }
    }

    const storagePaths = (audits || [])
      .map((item) => item.image_storage_path)
      .filter((path): path is string => Boolean(path));

    if (storagePaths.length) {
      const { error } = await supabase.storage
        .from(AUDIT_FILES_BUCKET)
        .remove(storagePaths);

      if (error) {
        throw new Error(error.message);
      }
    }

    for (const table of [
      "ai_traces",
      "content_generations",
      "image_audits",
      "brand_embeddings",
    ] as const) {
      const { error } = await supabase.from(table).delete().eq("brand_id", brandId);

      if (error) {
        throw new Error(error.message);
      }
    }

    const { error } = await supabase.from("brands").delete().eq("id", brandId);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, getAuthStatus(error));
  }
}
