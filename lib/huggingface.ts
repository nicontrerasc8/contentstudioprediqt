const DEFAULT_HF_BASE_URL = "https://router.huggingface.co/hf-inference/models";
const DEFAULT_HF_EMBED_MODEL =
  "sentence-transformers/paraphrase-multilingual-mpnet-base-v2";
const DEFAULT_HF_IMAGE_TO_TEXT_MODEL =
  "Salesforce/blip-image-captioning-large";
const DEFAULT_HF_IMAGE_CLASSIFICATION_MODEL = "google/vit-base-patch16-224";
const DEFAULT_HF_ZERO_SHOT_MODEL = "facebook/bart-large-mnli";

export const HF_EMBED_MODEL =
  process.env.HF_EMBED_MODEL || DEFAULT_HF_EMBED_MODEL;
export const HF_IMAGE_TO_TEXT_MODEL =
  process.env.HF_IMAGE_TO_TEXT_MODEL || DEFAULT_HF_IMAGE_TO_TEXT_MODEL;
export const HF_IMAGE_CLASSIFICATION_MODEL =
  process.env.HF_IMAGE_TO_TEXT_MODEL ||
  DEFAULT_HF_IMAGE_CLASSIFICATION_MODEL;
export const HF_ZERO_SHOT_MODEL =
  process.env.HF_IMAGE_TO_TEXT_MODEL || DEFAULT_HF_ZERO_SHOT_MODEL;

export type ImageLabel = {
  label: string;
  score: number;
};

export type ZeroShotSignal = {
  label: string;
  score: number;
};

type HfErrorResponse = {
  error?: string;
  estimated_time?: number;
};

type ImageToTextResponse =
  | Array<{
      generated_text?: string;
    }>
  | {
      generated_text?: string;
    };

type ZeroShotResponse =
  | {
      labels?: string[];
      scores?: number[];
    }
  | Array<{
      label?: string;
      score?: number;
    }>;

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function getHfBaseUrl() {
  return (process.env.HF_BASE_URL || DEFAULT_HF_BASE_URL).replace(/\/$/, "");
}

function getModelUrl(model: string) {
  return `${getHfBaseUrl()}/${model}`;
}

async function postHfJson<T>(model: string, body: unknown): Promise<T> {
  const response = await fetch(getModelUrl(model), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("HF_TOKEN")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? (JSON.parse(text) as T & HfErrorResponse) : null;

  if (!response.ok) {
    const warmup =
      data?.estimated_time && response.status === 503
        ? ` Estimated warmup: ${Math.ceil(data.estimated_time)}s.`
        : "";
    throw new Error(
      `${data?.error || `Hugging Face request failed with status ${response.status}`}${warmup}`,
    );
  }

  if (!data) {
    throw new Error("Hugging Face returned an empty response.");
  }

  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number");
}

function normalizeEmbedding(value: unknown): number[] {
  if (isNumberArray(value)) {
    return value;
  }

  if (!Array.isArray(value)) {
    throw new Error("Hugging Face did not return an embedding array.");
  }

  if (value.length === 1 && isNumberArray(value[0])) {
    return value[0];
  }

  if (value.every(isNumberArray)) {
    const matrix = value as number[][];
    const width = matrix[0]?.length || 0;

    if (!width) {
      throw new Error("Hugging Face returned an empty embedding matrix.");
    }

    return Array.from({ length: width }, (_, index) => {
      const sum = matrix.reduce((total, row) => total + (row[index] || 0), 0);
      return sum / matrix.length;
    });
  }

  throw new Error("Hugging Face returned an unsupported embedding shape.");
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
      const score = typeof entry.score === "number" ? entry.score : 0;

      return label ? { label, score } : null;
    })
    .filter((item): item is ImageLabel => Boolean(item))
    .slice(0, limit);
}

export async function generateEmbedding(input: string) {
  const data = await postHfJson<unknown>(HF_EMBED_MODEL, {
    inputs: input,
    normalize: true,
    truncate: true,
  });

  return normalizeEmbedding(data);
}

export async function describeImage(imageBase64: string) {
  const data = await postHfJson<ImageToTextResponse>(HF_IMAGE_TO_TEXT_MODEL, {
    inputs: imageBase64,
  });
  const generatedText = Array.isArray(data)
    ? data[0]?.generated_text
    : data.generated_text;

  if (!generatedText?.trim()) {
    throw new Error("Hugging Face did not return an image description.");
  }

  return generatedText.trim();
}

export async function classifyImage(imageBase64: string, topK = 5) {
  const data = await postHfJson<ImageLabel[]>(HF_IMAGE_CLASSIFICATION_MODEL, {
    inputs: imageBase64,
    parameters: {
      top_k: topK,
    },
  });

  return normalizeLabels(data, topK);
}

export async function classifyVisualSignals(input: {
  imageDescription: string;
  imageLabels: ImageLabel[];
}) {
  const data = await postHfJson<ZeroShotResponse>(HF_IMAGE_TO_TEXT_MODEL, {
    inputs: [
      input.imageDescription,
      input.imageLabels
        .map((label) => `${label.label} (${label.score.toFixed(2)})`)
        .join(", "),
    ]
      .filter(Boolean)
      .join("\n"),
    parameters: {
      candidate_labels: [
        "tono profesional",
        "tono informal",
        "estilo premium",
        "estilo generico",
        "consistente con marca",
        "riesgo de incumplimiento de marca",
      ],
      multi_label: true,
    },
  });

  if (Array.isArray(data)) {
    return normalizeLabels(data, 6) satisfies ZeroShotSignal[];
  }

  const labels = data.labels || [];
  const scores = data.scores || [];

  return labels
    .map((label, index) => ({
      label,
      score: typeof scores[index] === "number" ? scores[index] : 0,
    }))
    .filter((item) => item.label)
    .slice(0, 6);
}
