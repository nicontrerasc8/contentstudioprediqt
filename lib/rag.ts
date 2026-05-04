import { generateEmbedding } from "@/lib/gemini";
import type { Brand, Database, RagMatch } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function getBrandOrThrow(
  brandId: string,
  supabase: SupabaseClient<Database>,
): Promise<Brand> {
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("id", brandId)
    .single();

  if (error) {
    throw new Error(`Brand not found: ${error.message}`);
  }

  return data as Brand;
}

export async function getRelevantBrandContext(
  supabase: SupabaseClient<Database>,
  brandId: string,
  query: string,
  matchCount = 5,
) {
  const matches = await getRelevantBrandMatches(
    supabase,
    brandId,
    query,
    matchCount,
  );
  return formatBrandContext(matches);
}

export async function getRelevantBrandMatches(
  supabase: SupabaseClient<Database>,
  brandId: string,
  query: string,
  matchCount = 5,
) {
  const queryEmbedding = await generateEmbedding(query);

  const { data, error } = await supabase.rpc("match_brand_embeddings", {
    query_embedding: queryEmbedding,
    match_brand_id: brandId,
    match_count: matchCount,
  });

  if (error) {
    throw new Error(`RAG search failed: ${error.message}`);
  }

  return (data || []) as RagMatch[];
}

export function formatBrandContext(matches: RagMatch[]) {
  return matches.map((match) => match.chunk).join("\n\n---\n\n");
}
