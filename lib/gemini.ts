const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_GEMINI_VISION_MODEL = "gemini-2.5-flash";
const DEFAULT_GEMINI_EMBED_MODEL = "gemini-embedding-001";

export const GEMINI_VISION_MODEL =
  process.env.GEMINI_VISION_MODEL ||
  process.env.GEMINI_MULTIMODAL_MODEL ||
  DEFAULT_GEMINI_VISION_MODEL;
export const GEMINI_EMBED_MODEL =
  process.env.GEMINI_EMBED_MODEL || DEFAULT_GEMINI_EMBED_MODEL;

export type ImageLabel = {
  label: string;
  score: number;
};

export type ZeroShotSignal = {
  label: string;
  score: number;
};

type GeminiErrorResponse = {
  error?: {
    message?: string;
    status?: string;
  };
};

type GeminiGenerateResponse = GeminiErrorResponse & {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

type GeminiEmbedResponse = GeminiErrorResponse & {
  embedding?: {
    values?: number[];
  };
};

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function getGeminiBaseUrl() {
  return (process.env.GEMINI_BASE_URL || DEFAULT_GEMINI_BASE_URL).replace(
    /\/$/,
    "",
  );
}

function normalizeModelName(model: string) {
  return model.startsWith("models/") ? model : `models/${model}`;
}

function getModelUrl(model: string, method: "generateContent" | "embedContent") {
  return `${getGeminiBaseUrl()}/${normalizeModelName(model)}:${method}`;
}

async function postGeminiJson<T>(
  model: string,
  method: "generateContent" | "embedContent",
  body: unknown,
): Promise<T> {
  const response = await fetch(getModelUrl(model, method), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": requireEnv("GEMINI_API_KEY"),
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? (JSON.parse(text) as T & GeminiErrorResponse) : null;

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        `Gemini request failed with status ${response.status}`,
    );
  }

  if (!data) {
    throw new Error("Gemini returned an empty response.");
  }

  if (data.error?.message) {
    throw new Error(data.error.message);
  }

  return data;
}

function extractText(data: GeminiGenerateResponse) {
  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini did not return text content.");
  }

  return text;
}

function parseJsonObject<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] || text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Gemini did not return a JSON object.");
  }

  return JSON.parse(raw.slice(start, end + 1)) as T;
}

async function generateGeminiText(input: {
  prompt: string;
  imageBase64?: string;
  mimeType?: string;
  temperature?: number;
}) {
  const parts = [
    ...(input.imageBase64
      ? [
          {
            inline_data: {
              mime_type: input.mimeType || "image/jpeg",
              data: input.imageBase64,
            },
          },
        ]
      : []),
    { text: input.prompt },
  ];
  const data = await postGeminiJson<GeminiGenerateResponse>(
    GEMINI_VISION_MODEL,
    "generateContent",
    {
      contents: [{ parts }],
      generationConfig: {
        temperature: input.temperature ?? 0.2,
      },
    },
  );

  return extractText(data);
}

function normalizeScore(value: unknown) {
  const score = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.max(0, Math.min(1, score));
}

function normalizeLabels(value: unknown, limit: number): ImageLabel[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const entry = item as Record<string, unknown>;
      const label = typeof entry.label === "string" ? entry.label.trim() : "";
      const score = normalizeScore(entry.score);

      return label ? { label, score } : null;
    })
    .filter((item): item is ImageLabel => Boolean(item))
    .slice(0, limit);
}

export async function generateEmbedding(input: string) {
  const data = await postGeminiJson<GeminiEmbedResponse>(
    GEMINI_EMBED_MODEL,
    "embedContent",
    {
      model: normalizeModelName(GEMINI_EMBED_MODEL),
      content: {
        parts: [{ text: input }],
      },
      outputDimensionality: 768,
    },
  );
  const values = data.embedding?.values;

  if (!Array.isArray(values) || !values.every((item) => typeof item === "number")) {
    throw new Error("Gemini did not return an embedding array.");
  }

  return values;
}

export async function describeImage(imageBase64: string, mimeType?: string) {
  const text = await generateGeminiText({
    imageBase64,
    mimeType,
    temperature: 0.1,
    prompt:
      "Describe esta imagen en espanol con detalle objetivo para una auditoria de marca. No inventes elementos no visibles.",
  });

  return text.trim();
}

export async function classifyImage(
  imageBase64: string,
  mimeType?: string,
  topK = 5,
) {
  const text = await generateGeminiText({
    imageBase64,
    mimeType,
    temperature: 0,
    prompt: `Detecta hasta ${topK} etiquetas visuales generales de esta imagen. Devuelve solo JSON valido con esta forma: {"labels":[{"label":"string","score":0.0}]}. Los scores deben estar entre 0 y 1.`,
  });
  const data = parseJsonObject<{ labels?: unknown }>(text);

  return normalizeLabels(data.labels, topK);
}

export async function classifyVisualSignals(input: {
  imageDescription: string;
  imageLabels: ImageLabel[];
}) {
  const text = await generateGeminiText({
    temperature: 0,
    prompt: `Evalua estas senales visuales para auditoria de marca.

Descripcion:
${input.imageDescription}

Etiquetas:
${input.imageLabels
  .map((label) => `- ${label.label} (${label.score.toFixed(2)})`)
  .join("\n")}

Devuelve solo JSON valido con esta forma: {"signals":[{"label":"string","score":0.0}]}.
Usa exactamente estas etiquetas:
- tono profesional
- tono informal
- estilo premium
- estilo generico
- consistente con marca
- riesgo de incumplimiento de marca

Los scores deben estar entre 0 y 1.`,
  });
  const data = parseJsonObject<{ signals?: unknown }>(text);

  return normalizeLabels(data.signals, 6) satisfies ZeroShotSignal[];
}
