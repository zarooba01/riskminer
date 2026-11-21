import "server-only";

import { createHash } from "node:crypto";

import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

import { db } from "@/lib/supabase/admin";

export const DOCUMENT_BUCKET = "rm-documents";
export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;

export const documentTypes = ["aneks", "umowa", "SWZ / PFU / OPZ", "protokół odbioru", "protokół konieczności", "korespondencja", "inny"] as const;

export type ReadDocument = {
  kind: "pdf" | "docx";
  /** Tekst strony (PDF) albo fragmentu (DOCX nie ma stałych stron). */
  pages: string[];
  chars: number;
};

const clean = (s: string) => s.replace(/ /g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

/** DOCX nie ma stron — dzielimy tekst na fragmenty ~2500 znaków po granicach akapitów. */
function chunkParagraphs(text: string, size = 2500): string[] {
  const out: string[] = [];
  let current = "";
  for (const para of text.split(/\n+/)) {
    if (current && current.length + para.length > size) {
      out.push(current);
      current = "";
    }
    current += (current ? "\n" : "") + para;
  }
  if (current) out.push(current);
  return out;
}

/** Odczyt tekstu z PDF (z warstwą tekstową) lub DOCX — lokalnie, bez AI. */
export async function readDocument(buffer: ArrayBuffer, fileName: string): Promise<ReadDocument> {
  if (/\.pdf$/i.test(fileName)) {
    // pdf.js przejmuje (odłącza) przekazany bufor — dajemy mu kopię, oryginał jest potrzebny do zapisu pliku.
    const pdf = await getDocumentProxy(new Uint8Array(buffer.slice(0)));
    const { text } = await extractText(pdf, { mergePages: false });
    const pages = text.map(clean);
    const chars = pages.reduce((a, p) => a + p.length, 0);
    if (chars < 50) throw new Error("PDF nie ma warstwy tekstowej (to prawdopodobnie skan). OCR nie jest jeszcze obsługiwany.");
    return { kind: "pdf", pages, chars };
  }
  if (/\.docx$/i.test(fileName)) {
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
    const text = clean(value);
    if (text.length < 20) throw new Error("Dokument DOCX nie zawiera tekstu.");
    return { kind: "docx", pages: chunkParagraphs(text), chars: text.length };
  }
  throw new Error("Obsługiwane formaty: PDF (z warstwą tekstową) i DOCX.");
}

/** Słowa istotne dla przebiegu inwestycji — wstępny filtr stron przed wysłaniem do modelu (oszczędność tokenów). */
const relevant = /aneks|termin|wynagrodzeni|kwot|cen[ayie]\b|zmian|przyczyn|powod|kar[ayi]?\s|kara|odbi[óo]r|protok[oó]ł|wad[ayi]?\b|usterk|przedłuż|roboty dodatkowe|roboty zamienne|nieprzewidzian|opóźni|harmonogram|odstąpi|rozwiąza/gi;

/**
 * Wybór stron do analizy: pierwsza strona (strony umowy, data) + strony z najwięcej trafieniami słów istotnych,
 * do limitu znaków. Zwraca tekst ze znacznikami [str. N] i listę użytych stron.
 */
export function selectRelevantPages(pages: string[], limit: number): { text: string; used: number[]; total: number } {
  const scored = pages.map((text, i) => ({ i, text, hits: (text.match(relevant) ?? []).length }));
  const chosen = new Set<number>([0]);
  let budget = limit - (pages[0]?.length ?? 0);
  for (const p of [...scored].filter((s) => s.i !== 0 && s.hits > 0).sort((a, b) => b.hits - a.hits)) {
    if (budget <= 0) break;
    chosen.add(p.i);
    budget -= p.text.length;
  }
  // Krótki dokument mieści się cały — wtedy bierzemy wszystkie strony.
  if (pages.reduce((a, p) => a + p.length, 0) <= limit) pages.forEach((_, i) => chosen.add(i));
  const used = [...chosen].sort((a, b) => a - b);
  let left = limit;
  const text = used
    .map((i) => {
      const part = pages[i].slice(0, Math.max(0, left));
      left -= part.length;
      return part ? `[str. ${i + 1}]\n${part}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
  return { text, used: used.map((i) => i + 1), total: pages.length };
}

export type StoredDocument = { documentId: string; sourceId: string; pages: number; chars: number; kind: "pdf" | "docx" };

/** Zapis dokumentu: oryginał w prywatnym Storage, tekst stron w rm_sources, rekord w rm_documents. */
export async function storeDocument(input: { projectId: string; contractId: string | null; docType: string; file: File }): Promise<StoredDocument> {
  const { projectId, contractId, docType, file } = input;
  if (file.size > MAX_DOCUMENT_BYTES) throw new Error(`Plik ma ${(file.size / 1024 / 1024).toFixed(1)} MB — maksymalnie 4 MB.`);
  const buffer = await file.arrayBuffer();
  const read = await readDocument(buffer, file.name);
  const hash = createHash("sha256").update(Buffer.from(buffer)).digest("hex");
  const supabase = db();

  const storagePath = `${projectId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
  const { error: uploadError } = await supabase.storage.from(DOCUMENT_BUCKET).upload(storagePath, Buffer.from(buffer), {
    contentType: file.type || (read.kind === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    upsert: false,
  });
  if (uploadError) throw new Error(`Zapis pliku: ${uploadError.message}`);

  const { data: source, error: sourceError } = await supabase
    .from("rm_sources")
    .insert({
      kind: "upload",
      external_id: `${projectId}/${file.name}#${hash.slice(0, 12)}#${Date.now()}`,
      title: `${docType}: ${file.name}`,
      url: null,
      content_hash: hash,
      raw: { pages: read.pages, kind: read.kind, file_name: file.name, storage_path: storagePath, doc_type: docType },
      text_content: read.pages.map((p, i) => `[str. ${i + 1}]\n${p}`).join("\n\n"),
    })
    .select("id")
    .single();
  if (sourceError) throw new Error(`Zapis źródła: ${sourceError.message}`);

  const { data: doc, error: docError } = await supabase
    .from("rm_documents")
    .insert({
      project_id: projectId,
      contract_id: contractId,
      source_id: source.id,
      doc_type: docType,
      file_name: file.name,
      storage_path: storagePath,
      pages: read.pages.length,
      chars: read.chars,
      status: "processing",
    })
    .select("id")
    .single();
  if (docError) throw new Error(`Zapis dokumentu: ${docError.message}`);

  return { documentId: doc.id, sourceId: source.id, pages: read.pages.length, chars: read.chars, kind: read.kind };
}

/** Tymczasowy link do pobrania oryginału (1 h). */
export async function signedDocumentUrl(storagePath: string | null): Promise<string | null> {
  if (!storagePath) return null;
  const { data } = await db().storage.from(DOCUMENT_BUCKET).createSignedUrl(storagePath, 3600);
  return data?.signedUrl ?? null;
}
