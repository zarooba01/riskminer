import { BotIcon, CalculatorIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Rodzaj oceny: deterministyczna (reguły i obliczenia, bez AI — ten sam opis daje ten sam wynik) albo z AI
 * (dodatkowo wnioski modelu, oznaczone w wyniku jako „Model AI” i do decyzji eksperta).
 */
export function AssessmentKindBadge({ ai }: { ai: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={ai ? "default" : "secondary"} className="gap-1">
          {ai ? <BotIcon className="size-3" aria-hidden /> : <CalculatorIcon className="size-3" aria-hidden />}
          {ai ? "Z AI" : "Deterministyczna"}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-72">
        {ai
          ? "Przypadki i wnioski wybrał model AI z bazy porównawczej (do decyzji eksperta); mediany, przedziały i n policzone z danych tych przypadków."
          : "Reguły i obliczenia na danych z bazy, bez AI — ten sam opis i ta sama baza dają zawsze ten sam wynik."}
      </TooltipContent>
    </Tooltip>
  );
}
