import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SourceView } from "@/components/screens/source-view";
import { requireUser } from "@/lib/auth/session";
import { databaseConfigured, getSource } from "@/lib/rm/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Źródło" };

export default async function SourcePage({ params, searchParams }: PageProps<"/sources/[id]">) {
  await requireUser();
  const { id } = await params;
  const { q, from } = await searchParams;
  if (!databaseConfigured) notFound();
  const source = await getSource(id);
  if (!source) notFound();
  const quote = typeof q === "string" ? q : null;
  const project = typeof from === "string" && /^[\w-]{1,64}$/.test(from) ? from : null;
  return <SourceView source={source} quote={quote} backHref={project ? `/projects/${encodeURIComponent(project)}` : null} />;
}
