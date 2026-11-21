import { HexagonIcon } from "lucide-react";

import { appName } from "@shared/storybook";

export function Logo() {
  return (
    <span className="flex items-center gap-2 font-semibold">
      <span className="flex size-8 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        <HexagonIcon className="size-4" aria-hidden />
      </span>
      <span className="truncate">{appName}</span>
    </span>
  );
}
