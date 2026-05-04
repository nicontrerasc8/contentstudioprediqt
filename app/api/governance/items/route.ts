import { NextResponse } from "next/server";
import { getAuthStatus, requireAuth } from "@/lib/auth";
import type {
  ApprovalStatus,
  ApprovalReview,
  GovernanceItem,
  GovernanceItemType,
  Json,
} from "@/lib/types";

export const runtime = "nodejs";

function jsonError(error: unknown, status = 500) {
  const message =
    error instanceof Error ? error.message : "Unexpected server error.";

  return NextResponse.json({ error: message }, { status });
}

function isApprovalStatus(value: unknown): value is ApprovalStatus {
  return (
    value === "pendiente" || value === "aprobado" || value === "rechazado"
  );
}

function isGovernanceItemType(value: unknown): value is GovernanceItemType {
  return value === "content" || value === "image_audit";
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required.`);
  }

  return value.trim();
}

function toStringArray(value: Json | null | undefined) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function reviewKey(
  itemType: GovernanceItemType,
  itemId: string,
  role: ApprovalReview["reviewer_role"],
) {
  return `${itemType}:${itemId}:${role}`;
}

function findReview(
  reviews: Map<string, ApprovalReview>,
  itemType: GovernanceItemType,
  itemId: string,
  role: ApprovalReview["reviewer_role"],
) {
  return reviews.get(reviewKey(itemType, itemId, role)) || null;
}

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    const supabase = auth.supabase;
    const [brandsResult, contentResult, auditsResult, reviewsResult] =
      await Promise.all([
        supabase.from("brands").select("id,name"),
        supabase
          .from("content_generations")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(25),
        supabase
          .from("image_audits")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(25),
        supabase
          .from("approval_reviews")
          .select("*")
          .order("updated_at", { ascending: false })
          .limit(200),
      ]);

    if (brandsResult.error) {
      throw new Error(brandsResult.error.message);
    }

    if (contentResult.error) {
      throw new Error(contentResult.error.message);
    }

    if (auditsResult.error) {
      throw new Error(auditsResult.error.message);
    }

    if (reviewsResult.error) {
      throw new Error(reviewsResult.error.message);
    }

    const brandNames = new Map(
      (brandsResult.data || []).map((brand) => [brand.id, brand.name]),
    );
    const reviews = new Map(
      (reviewsResult.data || []).map((review) => [
        reviewKey(review.item_type, review.item_id, review.reviewer_role),
        review,
      ]),
    );
    const contentItems: GovernanceItem[] = (contentResult.data || []).map(
      (generation) => {
        const reviewA = findReview(
          reviews,
          "content",
          generation.id,
          "aprobador_a",
        );
        const reviewB = findReview(
          reviews,
          "content",
          generation.id,
          "aprobador_b",
        );

        return {
          id: generation.id,
          itemType: "content",
          brandId: generation.brand_id,
          brandName: brandNames.get(generation.brand_id) || "Marca sin nombre",
          title: generation.type,
          body: generation.output,
          approvalStatus: generation.approval_status,
          createdAt: generation.created_at,
          reviewedBy: generation.reviewed_by,
          reviewNote: generation.review_note,
          reviewedAt: generation.reviewed_at,
          reviewAStatus: reviewA?.decision || "pendiente",
          reviewANote: reviewA?.note || null,
          reviewABy: reviewA?.reviewer_id || null,
          reviewAAt: reviewA?.updated_at || null,
          reviewBStatus: reviewB?.decision || generation.approval_status,
          reviewBNote: reviewB?.note || generation.review_note,
          reviewBBy: reviewB?.reviewer_id || generation.reviewed_by,
          reviewBAt: reviewB?.updated_at || generation.reviewed_at,
          aiStatus: generation.compliance_status,
          issues: toStringArray(generation.compliance_issues),
        };
      },
    );
    const auditItems: GovernanceItem[] = (auditsResult.data || []).map(
      (audit) => {
        const reviewA = findReview(
          reviews,
          "image_audit",
          audit.id,
          "aprobador_a",
        );
        const reviewB = findReview(
          reviews,
          "image_audit",
          audit.id,
          "aprobador_b",
        );

        return {
          id: audit.id,
          itemType: "image_audit",
          brandId: audit.brand_id,
          brandName: brandNames.get(audit.brand_id) || "Marca sin nombre",
          title: audit.image_name,
          body: audit.recommendation,
          approvalStatus: audit.approval_status,
          createdAt: audit.created_at,
          reviewedBy: audit.reviewed_by,
          reviewNote: audit.review_note,
          reviewedAt: audit.reviewed_at,
          reviewAStatus: reviewA?.decision || "pendiente",
          reviewANote: reviewA?.note || null,
          reviewABy: reviewA?.reviewer_id || null,
          reviewAAt: reviewA?.updated_at || null,
          reviewBStatus: reviewB?.decision || audit.approval_status,
          reviewBNote: reviewB?.note || audit.review_note,
          reviewBBy: reviewB?.reviewer_id || audit.reviewed_by,
          reviewBAt: reviewB?.updated_at || audit.reviewed_at,
          aiStatus: audit.status,
          score: audit.score,
          issues: toStringArray(audit.issues),
        };
      },
    );
    const items = [...contentItems, ...auditItems].sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    );

    return NextResponse.json({ items });
  } catch (error) {
    return jsonError(error, getAuthStatus(error));
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth(request, ["aprobador_a", "aprobador_b"]);
    const payload = (await request.json()) as Record<string, unknown>;
    const itemType = payload.itemType;
    const id = requiredString(payload.id, "id");
    const approvalStatus = payload.approvalStatus;
    const reviewNote =
      typeof payload.reviewNote === "string" ? payload.reviewNote.trim() : null;

    if (!isGovernanceItemType(itemType)) {
      throw new Error("Invalid itemType.");
    }

    if (!isApprovalStatus(approvalStatus)) {
      throw new Error("Invalid approvalStatus.");
    }

    const reviewerRole = auth.profile.role;

    if (reviewerRole !== "aprobador_a" && reviewerRole !== "aprobador_b") {
      return jsonError(new Error("Solo aprobadores pueden revisar."), 403);
    }

    const supabase = auth.supabase;

    if (reviewerRole === "aprobador_b") {
      const { data: reviewA, error: reviewAError } = await supabase
        .from("approval_reviews")
        .select("decision")
        .eq("item_type", itemType)
        .eq("item_id", id)
        .eq("reviewer_role", "aprobador_a")
        .maybeSingle();

      if (reviewAError) {
        throw new Error(reviewAError.message);
      }

      if (reviewA?.decision !== "aprobado") {
        return jsonError(
          new Error("Aprobador B requiere aprobacion previa de Aprobador A."),
          403,
        );
      }
    }

    const reviewResult = await supabase
      .from("approval_reviews")
      .upsert(
        {
          item_type: itemType,
          item_id: id,
          reviewer_id: auth.user.id,
          reviewer_role: reviewerRole,
          decision: approvalStatus,
          note: reviewNote,
        },
        { onConflict: "item_type,item_id,reviewer_role" },
      )
      .select("*")
      .single();

    if (reviewResult.error) {
      throw new Error(reviewResult.error.message);
    }

    if (reviewerRole !== "aprobador_b") {
      return NextResponse.json({ review: reviewResult.data });
    }

    const update = {
      approval_status: approvalStatus,
      reviewed_by: `${auth.profile.full_name} (${auth.profile.role})`,
      review_note: reviewNote,
      reviewed_at: new Date().toISOString(),
    };
    const itemResult =
      itemType === "content"
        ? await supabase
            .from("content_generations")
            .update(update)
            .eq("id", id)
            .select("*")
            .single()
        : await supabase
            .from("image_audits")
            .update(update)
            .eq("id", id)
            .select("*")
            .single();

    if (itemResult.error) {
      throw new Error(itemResult.error.message);
    }

    return NextResponse.json({
      item: itemResult.data,
      review: reviewResult.data,
    });
  } catch (error) {
    return jsonError(error, getAuthStatus(error));
  }
}
