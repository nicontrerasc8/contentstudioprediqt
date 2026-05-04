const DEFAULT_GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_GROQ_TEXT_MODEL = "openai/gpt-oss-120b";

export const GROQ_TEXT_MODEL =
  process.env.GROQ_TEXT_MODEL ||
  process.env.GROQ_CHAT_MODEL ||
  DEFAULT_GROQ_TEXT_MODEL;

type GenerateOptions = {
  temperature?: number;
  format?: "json";
};

type GroqChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
};

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function getGroqBaseUrl() {
  return (process.env.GROQ_BASE_URL || DEFAULT_GROQ_BASE_URL).replace(
    /\/$/,
    "",
  );
}

export async function generateText(
  prompt: string,
  options: GenerateOptions = {},
) {
  const response = await fetch(`${getGroqBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("GROQ_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_TEXT_MODEL,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: options.temperature ?? 0.35,
      ...(options.format
        ? {
            response_format: {
              type: "json_object",
            },
          }
        : {}),
    }),
  });
  const text = await response.text();
  const data = text
    ? (JSON.parse(text) as GroqChatCompletionResponse)
    : null;

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        `Groq request failed with status ${response.status}`,
    );
  }

  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Groq did not return generated text.");
  }

  return content.trim();
}

export function parseJsonObject<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      throw new Error("The model response did not contain valid JSON.");
    }

    return JSON.parse(raw.slice(start, end + 1)) as T;
  }
}
