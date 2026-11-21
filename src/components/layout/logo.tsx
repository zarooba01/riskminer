import Image from "next/image";

import { appConfig } from "@/lib/config";
import { cn } from "@/lib/utils";

export function Logo({ className, hideName = false }: { className?: string; hideName?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2 font-semibold", className)}>
      <Image src="/logo.png" alt={hideName ? appConfig.name : ""} width={28} height={28} className="size-7 shrink-0" priority />
      {!hideName && <span className="truncate">{appConfig.name}</span>}
    </span>
  );
}
