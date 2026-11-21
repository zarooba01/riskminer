import { HexagonIcon } from "lucide-react";

import { appConfig } from "@/lib/config";
import { cn } from "@/lib/utils";

export function Logo({ className, hideName = false }: { className?: string; hideName?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2 font-semibold", className)}>
      <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <HexagonIcon className="size-4" aria-hidden />
      </span>
      {!hideName && <span className="truncate">{appConfig.name}</span>}
    </span>
  );
}
