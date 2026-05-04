import { NextResponse } from "next/server";
import { getAuthStatus, requireAuth } from "@/lib/auth";
import type { AiTraceOperation } from "@/lib/types";

export const runtime = "nodejs";

function jsonError(error: unknown, status = 500) {
  const message =
    error instanceof Error ? error.message : "Unexpected server error.";

  return NextResponse.json({ error: message }, { status });
}

function isAiTraceOperation(value: string): value is AiTraceOperation {
  return (
    value === "brand_manual" ||
    value === "creative_generation" ||
    value === "creative_compliance" ||
    value === "image_audit"
  );
}

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      100,
      Math.max(1, Number(searchParams.get("limit") || 25)),
    );
    const operation = searchParams.get("operation") || "";
    let query = auth.supabase
      .from("ai_traces")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (operation) {
      if (!isAiTraceOperation(operation)) {
        throw new Error("Invalid operation filter.");
      }

      query = query.eq("operation", operation);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ traces: data || [] });
  } catch (error) {
    return jsonError(error, getAuthStatus(error));
  }
}
