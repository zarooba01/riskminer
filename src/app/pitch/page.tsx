import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Metadata } from "next";

import { Deck } from "@/components/pitch/deck";

export const metadata: Metadata = { title: "Prezentacja" };

/** Treść slajdów: content/pitch.md (wczytywana przy buildzie). */
export default async function PitchPage() {
  const markdown = await readFile(path.join(process.cwd(), "content/pitch.md"), "utf8");
  return <Deck markdown={markdown} />;
}
