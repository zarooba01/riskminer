import "server-only";

type Price = { input: number; output: number; cacheRead: number; cacheWrite: number };

let cache: { at: number; prices: Map<string, Price> } | undefined;

/** Cennik z publicznego katalogu AI Gateway (USD za token), odświeżany co godzinę. */
export async function getPrices(): Promise<Map<string, Price>> {
  if (cache && Date.now() - cache.at < 3_600_000) return cache.prices;
  const prices = new Map<string, Price>();
  try {
    const response = await fetch("https://ai-gateway.vercel.sh/v1/models", { signal: AbortSignal.timeout(15_000) });
    const { data } = (await response.json()) as { data: { id: string; pricing?: Record<string, string> }[] };
    for (const model of data) {
      const p = model.pricing ?? {};
      prices.set(model.id, {
        input: Number(p.input ?? 0),
        output: Number(p.output ?? 0),
        cacheRead: Number(p.input_cache_read ?? p.input ?? 0),
        cacheWrite: Number(p.input_cache_write ?? p.input ?? 0),
      });
    }
    cache = { at: Date.now(), prices };
  } catch {
    // Brak cennika nie blokuje analizy — koszt zostanie pusty.
  }
  return prices;
}

export async function estimateCost(model: string, usage: { noCache: number; cacheRead: number; cacheWrite: number; output: number }) {
  const price = (await getPrices()).get(model);
  if (!price) return null;
  return usage.noCache * price.input + usage.cacheRead * price.cacheRead + usage.cacheWrite * price.cacheWrite + usage.output * price.output;
}
