import { NextResponse } from "next/server";
import { AuthError, getAuthStatus, requireAuth } from "@/lib/auth";
import {
  generateText,
  GROQ_TEXT_MODEL,
  parseJsonObject,
} from "@/lib/groq";
import {
  classifyImage,
  classifyVisualSignals,
  describeImage,
  GEMINI_VISION_MODEL,
} from "@/lib/gemini";
import {
  buildTracePayload,
  errorMessage,
  recordAiTrace,
  runObservedGeneration,
} from "@/lib/observability";
import { buildImageAuditPrompt } from "@/lib/prompts";
import { getBrandOrThrow } from "@/lib/rag";
import {
  AUDIT_FILES_BUCKET,
  buildAuditFilePath,
  createAuditFileSignedUrl,
} from "@/lib/storage";
import type { Database, ImageAuditResult, ImageAuditStatus } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function jsonError(error: unknown, status = 500) {
  const message =
    error instanceof Error ? error.message : "Unexpected server error.";

  return NextResponse.json({ error: message }, { status });
}

function normalizeStatus(value: unknown): ImageAuditStatus {
  return value === "check" ? "check" : "rechazado";
}

function normalizeScore(value: unknown) {
  const score = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
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

function normalizeAuditResult(value: Partial<ImageAuditResult>) {
  return {
    status: normalizeStatus(value.status),
    score: normalizeScore(value.score),
    issues: normalizeIssues(value.issues),
    recommendation:
      typeof value.recommendation === "string" && value.recommendation.trim()
        ? value.recommendation.trim()
        : "Revisar la pieza contra el manual de marca antes de publicarla.",
  } satisfies ImageAuditResult;
}

export async function POST(request: Request) {
  let brandIdForTrace: string | null = null;
  let prompt = "";
  let supabaseForTrace: SupabaseClient<Database> | null = null;
  let uploadedPath: string | null = null;
  const startedAt = Date.now();

  try {
    const auth = await requireAuth(request, ["creador"]);
    supabaseForTrace = auth.supabase;
    const formData = await request.formData();
    const brandId = formData.get("brandId");
    const image = formData.get("image");

    if (typeof brandId !== "string" || !brandId.trim()) {
      throw new Error("brandId is required.");
    }

    if (!(image instanceof File) || image.size === 0) {
      throw new Error("image is required.");
    }

    if (!image.type.startsWith("image/")) {
      throw new Error("The uploaded file must be an image.");
    }

    brandIdForTrace = brandId.trim();
    const brand = await getBrandOrThrow(brandIdForTrace, auth.supabase);
    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const imageBase64 = imageBuffer.toString("base64");
    uploadedPath = buildAuditFilePath({
      userId: auth.user.id,
      brandId: brand.id,
      fileName: image.name,
    });
    const { error: uploadError } = await auth.supabase.storage
      .from(AUDIT_FILES_BUCKET)
      .upload(uploadedPath, imageBuffer, {
        contentType: image.type,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const [imageDescription, imageLabels] = await Promise.all([
      describeImage(imageBase64, image.type),
      classifyImage(imageBase64, image.type),
    ]);
    const visualSignals = await classifyVisualSignals({
      imageDescription,
      imageLabels,
    });

    prompt = buildImageAuditPrompt({
      brandName: brand.name,
      manualText: brand.manual_text,
      imageName: image.name,
      imageDescription,
      imageLabels,
      visualSignals,
    });
    const observedAudit = await runObservedGeneration(
      {
        name: "governance.image-audit",
        model: GROQ_TEXT_MODEL,
        prompt,
        input: {
          brandId: brand.id,
          imageName: image.name,
          imageType: image.type,
          imageSize: image.size,
          imageDescription,
          imageLabels,
          visualSignals,
        },
        metadata: {
          module: "Governance & Multimodal Audit",
          provider: "groq+gemini",
          visionModel: GEMINI_VISION_MODEL,
        },
        modelParameters: {
          temperature: 0.1,
        },
      },
      () =>
        generateText(prompt, {
          format: "json",
          temperature: 0.1,
        }),
    );
    const rawAudit = observedAudit.result;

    const result = normalizeAuditResult(
      parseJsonObject<Partial<ImageAuditResult>>(rawAudit),
    );

    const supabase = auth.supabase;
    const { data: audit, error } = await supabase
      .from("image_audits")
      .insert({
        brand_id: brand.id,
        created_by: auth.user.id,
        image_name: image.name,
        image_storage_path: uploadedPath,
        image_mime_type: image.type,
        image_size_bytes: image.size,
        status: result.status,
        score: result.score,
        issues: result.issues,
        recommendation: result.recommendation,
        approval_status: "pendiente",
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    await recordAiTrace(
      buildTracePayload({
        operation: "image_audit",
        brandId: brand.id,
        itemType: "image_audit",
        itemId: audit.id,
        model: GROQ_TEXT_MODEL,
        prompt,
        ragContext: brand.manual_text,
        input: {
          brandId: brand.id,
          imageName: image.name,
          imageType: image.type,
          imageSize: image.size,
          imageStoragePath: uploadedPath,
          imageDescription,
          imageLabels,
          visualSignals,
        },
        output: rawAudit,
        durationMs: observedAudit.durationMs,
        langfuseEnabled: observedAudit.langfuseEnabled,
        langfuseTraceId: observedAudit.langfuseTraceId,
        langfuseObservationId: observedAudit.langfuseObservationId,
        metadata: {
          provider: "groq+gemini",
          visionModel: GEMINI_VISION_MODEL,
          result,
          imageStoragePath: uploadedPath,
        },
      }),
      supabase,
    );
    const imageUrl = await createAuditFileSignedUrl(supabase, uploadedPath);

    return NextResponse.json({ audit, result, imageUrl });
  } catch (error) {
    if (uploadedPath && supabaseForTrace) {
      await supabaseForTrace.storage
        .from(AUDIT_FILES_BUCKET)
        .remove([uploadedPath])
        .catch(() => null);
    }

    if (!(error instanceof AuthError)) {
      await recordAiTrace(
        buildTracePayload({
          operation: "image_audit",
          brandId: brandIdForTrace,
          model: GROQ_TEXT_MODEL,
          prompt: prompt || "Prompt could not be built.",
          error: errorMessage(error),
          durationMs: Date.now() - startedAt,
        }),
        supabaseForTrace ?? undefined,
      );
    }

    return jsonError(error, getAuthStatus(error));
  }
}
