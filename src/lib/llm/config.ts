/**
 * Konfiguracja modeli — wyłącznie przez zmienne środowiskowe, bez zmian w kodzie.
 * Identyfikatory to `dostawca/model` z katalogu Vercel AI Gateway (https://ai-gateway.vercel.sh/v1/models).
 */
const list = (value: string | undefined, fallback: string[]) =>
  value
    ? value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
    : fallback;

export const llmConfig = {
  /** Model produkcyjny do analizy ryzyk. */
  model: process.env.LLM_MODEL ?? "anthropic/claude-haiku-5.5",
  /** Modele do porównania na ekranie „Modele”. */
  compareModels: list(process.env.LLM_COMPARE_MODELS, [
    "anthropic/claude-haiku-5.5",
    "openai/gpt-6-luna",
    "deepseek/deepseek-v4-flash",
    "mistral/ministral-14b",
    "google/gemini-3.1-flash-lite",
    "alibaba/qwen3.7-flash",
  ]),
  /** Limit znaków wejścia na jedno wywołanie (kontrola kosztu). */
  maxInputChars: Number(process.env.LLM_MAX_INPUT_CHARS ?? 24000),
  /** Twardy limit kosztu jednego porównania (USD) — przerywa, gdy suma przekroczy próg. */
  maxCompareUsd: Number(process.env.LLM_MAX_COMPARE_USD ?? 0.5),
};

/** Gdzie przetwarzane są dane — informacja dla eksperta i jury (dostawca modelu, region). */
export const providerRegion: Record<string, string> = {
  anthropic: "USA (Anthropic)",
  openai: "USA (OpenAI)",
  google: "USA/UE (Google)",
  mistral: "UE (Mistral, Francja)",
  deepseek: "Chiny/USA (DeepSeek przez dostawców AI Gateway)",
  alibaba: "Chiny/Singapur (Alibaba)",
};

export const regionOf = (model: string) => providerRegion[model.split("/")[0]] ?? "zależnie od dostawcy";
