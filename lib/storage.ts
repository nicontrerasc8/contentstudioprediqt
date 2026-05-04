import type { Database } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const AUDIT_FILES_BUCKET = "brand-audit-files";

function sanitizeFileName(fileName: string) {
  const clean = fileName
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return clean || "upload";
}

export function buildAuditFilePath(input: {
  userId: string;
  brandId: string;
  fileName: string;
}) {
  return `${input.userId}/${input.brandId}/${crypto.randomUUID()}-${sanitizeFileName(
    input.fileName,
  )}`;
}

export async function createAuditFileSignedUrl(
  supabase: SupabaseClient<Database>,
  path: string | null | undefined,
) {
  if (!path) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from(AUDIT_FILES_BUCKET)
    .createSignedUrl(path, 60 * 60);

  if (error) {
    console.error("Audit file signed URL could not be created.", error.message);
    return null;
  }

  return data.signedUrl;
}
