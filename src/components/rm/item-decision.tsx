"use client";

import { CheckIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { Status } from "@/lib/rm/types";

import type { ItemDecision as Decide } from "./assessment-item-row";
import { StatusBadge } from "./provenance";

/** Decyzja eksperta o wniosku AI (status + zatwierdź / odrzuć / przywróć). */
export function ItemDecision({ id, status, decide }: { id: string; status: Status; decide: Decide }) {
  const [pending, start] = useTransition();
  const run = (decision: "accept" | "reject" | "reopen") =>
    start(async () => {
      const result = await decide(id, decision);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  return (
    <span className="ml-auto flex items-center gap-1">
      <StatusBadge status={status} />
      {status === "proposed" ? (
        <>
          <Button size="icon" variant="ghost" className="size-8 text-success" disabled={pending} onClick={() => run("accept")} aria-label="Zatwierdź wniosek">
            <CheckIcon />
          </Button>
          <Button size="icon" variant="ghost" className="size-8 text-destructive" disabled={pending} onClick={() => run("reject")} aria-label="Odrzuć wniosek">
            <XIcon />
          </Button>
        </>
      ) : (
        <Button size="icon" variant="ghost" className="size-8" disabled={pending} onClick={() => run("reopen")} aria-label="Przywróć do weryfikacji">
          <RotateCcwIcon />
        </Button>
      )}
    </span>
  );
}
