import { CircleSlashIcon } from "lucide-react";

/** Jawny brak informacji w źródle — odróżnia „źródło nie podaje” od „nie ma problemu”. */
export function MissingData({ text = "brak danych w źródle" }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground italic">
      <CircleSlashIcon className="size-3.5" aria-hidden /> {text}
    </span>
  );
}
