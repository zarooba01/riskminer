"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { ActionResult } from "@/lib/rm/format";

type ActionButtonProps = Omit<React.ComponentProps<typeof Button>, "onClick"> & {
  action: () => Promise<ActionResult>;
  pendingLabel?: string;
};

/** Przycisk wywołujący server action z informacją zwrotną (toast). */
export function ActionButton({ action, pendingLabel, children, disabled, ...props }: ActionButtonProps) {
  const [pending, start] = useTransition();
  return (
    <Button
      {...props}
      disabled={disabled || pending}
      onClick={() =>
        start(async () => {
          const result = await action();
          if (result.ok) toast.success(result.message);
          else toast.error(result.message);
        })
      }
    >
      {pending ? (
        <>
          <Spinner /> {pendingLabel ?? "Trwa…"}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
