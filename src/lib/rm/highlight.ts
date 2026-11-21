/** Zakres znaków w oryginalnym tekście źródła. */
export type Range = { start: number; end: number };

const isSkippable = (ch: string) => /[\s"„”«»]/.test(ch);

/** Tekst znormalizowany (małe litery, białe znaki i cudzysłowy → jedna spacja) + mapa indeksów do oryginału. */
function normalizeWithMap(text: string): { norm: string; map: number[] } {
  let norm = "";
  const map: number[] = [];
  let space = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (isSkippable(ch)) {
      if (!space && norm.length) {
        norm += " ";
        map.push(i);
      }
      space = true;
      continue;
    }
    space = false;
    norm += ch.toLowerCase();
    map.push(i);
  }
  return { norm, map };
}

const normalize = (s: string) => normalizeWithMap(s).norm.trim();

/**
 * Fragmenty cytatu w tekście źródła (bez względu na białe znaki, cudzysłowy i wielkość liter).
 * Cytat złożony wielokropkiem („…”, „...”, „[...]”) szukamy częściami, każdą od miejsca poprzedniej.
 */
export function findQuote(text: string, quote: string | null | undefined): Range[] {
  if (!quote) return [];
  const { norm, map } = normalizeWithMap(text);
  const parts = quote
    .split(/\s*(?:\[\.\.\.\]|\.\.\.|…)\s*/)
    .map(normalize)
    .filter((p) => p.length >= 8);
  const ranges: Range[] = [];
  let from = 0;
  for (const part of parts) {
    let at = norm.indexOf(part, from);
    if (at < 0) at = norm.indexOf(part);
    if (at < 0) continue;
    ranges.push({ start: map[at], end: map[at + part.length - 1] + 1 });
    from = at + part.length;
  }
  return ranges.sort((a, b) => a.start - b.start);
}

/** Podział tekstu na kawałki zwykłe i zaznaczone (do renderowania <mark>). */
export function splitByRanges(text: string, ranges: Range[]): { text: string; marked: boolean }[] {
  const out: { text: string; marked: boolean }[] = [];
  let pos = 0;
  for (const r of ranges) {
    if (r.start < pos) continue;
    if (r.start > pos) out.push({ text: text.slice(pos, r.start), marked: false });
    out.push({ text: text.slice(r.start, r.end), marked: true });
    pos = r.end;
  }
  if (pos < text.length) out.push({ text: text.slice(pos), marked: false });
  return out;
}

/** Adres podglądu źródła w aplikacji z zaznaczonym cytatem; `from` — projekt, do którego prowadzi „Wróć”. */
export function sourceViewHref(sourceId: string, quote?: string | null, from?: string | null): string {
  const params = new URLSearchParams();
  if (quote) params.set("q", quote.slice(0, 600));
  if (from) params.set("from", from);
  const query = params.size ? `?${params}` : "";
  return `/sources/${encodeURIComponent(sourceId)}${query}${quote ? "#fragment" : ""}`;
}
