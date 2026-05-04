import { generateEmbedding } from "@/lib/gemini";

const DEFAULT_CHUNK_SIZE = 1200;
const DEFAULT_OVERLAP = 180;
const EXPECTED_EMBEDDING_SIZE = 768;

export function chunkText(
  text: string,
  maxChars = DEFAULT_CHUNK_SIZE,
  overlap = DEFAULT_OVERLAP,
) {
  const normalized = text.replace(/\r\n/g, "\n").trim();

  if (!normalized) {
    return [];
  }

  const paragraphs = normalized.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const cleanParagraph = paragraph.trim();

    if (!cleanParagraph) {
      continue;
    }

    if (cleanParagraph.length > maxChars) {
      if (current) {
        chunks.push(current.trim());
        current = "";
      }

      for (let i = 0; i < cleanParagraph.length; i += maxChars - overlap) {
        chunks.push(cleanParagraph.slice(i, i + maxChars).trim());
      }

      continue;
    }

    const next = current ? `${current}\n\n${cleanParagraph}` : cleanParagraph;

    if (next.length > maxChars && current) {
      chunks.push(current.trim());
      current = cleanParagraph;
    } else {
      current = next;
    }
  }

  if (current) {
    chunks.push(current.trim());
  }

  return chunks;
}

export async function embedChunks(chunks: string[]) {
  const embeddings: number[][] = [];

  for (const chunk of chunks) {
    const embedding = await generateEmbedding(chunk);

    if (embedding.length !== EXPECTED_EMBEDDING_SIZE) {
      throw new Error(
        `Unexpected embedding size ${embedding.length}. Expected ${EXPECTED_EMBEDDING_SIZE}.`,
      );
    }

    embeddings.push(embedding);
  }

  return embeddings;
}
