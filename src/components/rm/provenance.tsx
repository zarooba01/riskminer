import { BotIcon, CalculatorIcon, FileTextIcon, PencilLineIcon, UserCheckIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Wyraźne rozróżnienie: dane źródłowe, obliczenia, wnioski modelu, decyzja eksperta (wymóg wyzwania). */
const kinds = {
  source: { label: "Źródło", icon: FileTextIcon, hint: "Wartość przepisana ze wskazanego dokumentu.", variant: "outline" },
  calc: { label: "Obliczenie", icon: CalculatorIcon, hint: "Wyliczone deterministycznie z danych źródłowych.", variant: "secondary" },
  rule: { label: "Reguła", icon: CalculatorIcon, hint: "Propozycja reguły na podstawie katalogu ekspertów — wymaga zatwierdzenia.", variant: "secondary" },
  llm: { label: "Model AI", icon: BotIcon, hint: "Wniosek modelu językowego — wymaga zatwierdzenia przez eksperta.", variant: "default" },
  expert: { label: "Ekspert", icon: UserCheckIcon, hint: "Wpis lub decyzja eksperta.", variant: "outline" },
  input: { label: "Dane użytkownika", icon: PencilLineIcon, hint: "Informacja podana w opisie planowanej inwestycji — wymaga lokalnego potwierdzenia.", variant: "outline" },
} as const;

export type ProvenanceKind = keyof typeof kinds;

export function Provenance({ kind }: { kind: ProvenanceKind }) {
  const k = kinds[kind];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={k.variant} className="gap-1">
          <k.icon className="size-3" aria-hidden /> {k.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{k.hint}</TooltipContent>
    </Tooltip>
  );
}

export function StatusBadge({ status }: { status: "proposed" | "accepted" | "rejected" }) {
  const map = {
    proposed: { label: "Do weryfikacji", variant: "secondary" },
    accepted: { label: "Zatwierdzone", variant: "default" },
    rejected: { label: "Odrzucone", variant: "destructive" },
  } as const;
  return <Badge variant={map[status].variant}>{map[status].label}</Badge>;
}

export function Confidence({ value }: { value: number | null }) {
  if (value == null) return null;
  const level = value >= 0.85 ? "wysoka" : value >= 0.6 ? "średnia" : "niska";
  return (
    <Badge variant={value >= 0.85 ? "outline" : value >= 0.6 ? "secondary" : "destructive"}>
      pewność {level} ({Math.round(value * 100)}%)
    </Badge>
  );
}
