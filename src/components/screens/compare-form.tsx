"use client";

import { PlayIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type { ActionResult } from "@/lib/rm/format";

type Props = {
  projects: { id: string; title: string }[];
  selectedProject: string | null;
  models: { id: string; region: string; price: string }[];
  compare: (projectId: string, models: string[]) => Promise<ActionResult>;
};

export function CompareForm({ projects, selectedProject, models, compare }: Props) {
  const router = useRouter();
  const [project, setProject] = useState(selectedProject ?? projects[0]?.id ?? "");
  const [chosen, setChosen] = useState<string[]>(models.slice(0, 3).map((m) => m.id));
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      const result = await compare(project, chosen);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      router.push(`/llm?project=${encodeURIComponent(project)}`);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="project">Projekt (ten sam wsad dla wszystkich modeli)</FieldLabel>
        <Select
          value={project}
          onValueChange={(v) => {
            setProject(v);
            router.push(`/llm?project=${encodeURIComponent(v)}`);
          }}
        >
          <SelectTrigger id="project" className="w-full">
            <SelectValue placeholder="Wybierz wzbogacony projekt" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.id} — {p.title.slice(0, 70)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-medium">Modele</legend>
        {models.map((m) => (
          <Label key={m.id} className="flex items-start gap-2 rounded-lg border p-3 font-normal">
            <Checkbox
              checked={chosen.includes(m.id)}
              onCheckedChange={(v) => setChosen((prev) => (v ? [...prev, m.id] : prev.filter((x) => x !== m.id)))}
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-mono text-xs">{m.id}</span>
              <span className="text-xs text-muted-foreground">
                {m.price} · dane: {m.region}
              </span>
            </span>
          </Label>
        ))}
      </fieldset>
      <Button onClick={run} disabled={pending || !project || !chosen.length} className="self-start">
        {pending ? <Spinner /> : <PlayIcon />} Uruchom porównanie
      </Button>
      <p className="text-xs text-muted-foreground">
        Wynik każdego modelu jest zapisywany (rm_llm_runs) i cache’owany — powtórne uruchomienie tego samego wsadu nic nie kosztuje.
      </p>
    </div>
  );
}
