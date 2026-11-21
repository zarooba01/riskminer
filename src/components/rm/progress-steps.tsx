"use client";

import { CheckCircle2Icon, CheckIcon, CircleIcon, MinusCircleIcon, MinusIcon, XCircleIcon, XIcon } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type StepState = "pending" | "running" | "done" | "error" | "skipped";

export type ProgressStep = {
  id: string;
  title: string;
  state: StepState;
  /** Podsumowanie po zakończeniu (zostaje na ekranie). */
  summary?: string;
  /** Co dzieje się w tej chwili (tylko w trakcie). */
  current?: string;
  progress?: { done: number; total: number };
  /** Trwały dziennik — jedna pozycja na projekt / operację. */
  details?: { text: string; status: "ok" | "error" | "info" }[];
};

function StepIcon({ state }: { state: StepState }) {
  if (state === "running") return <Spinner className="size-5 text-primary" />;
  if (state === "done") return <CheckCircle2Icon className="size-5 text-success" aria-hidden />;
  if (state === "error") return <XCircleIcon className="size-5 text-destructive" aria-hidden />;
  if (state === "skipped") return <MinusCircleIcon className="size-5 text-muted-foreground" aria-hidden />;
  return <CircleIcon className="size-5 text-muted-foreground/50" aria-hidden />;
}

const stateLabel: Record<StepState, string> = {
  pending: "oczekuje",
  running: "w toku",
  done: "zakończono",
  error: "błąd",
  skipped: "pominięto",
};

/**
 * Lista etapów długiej operacji. Pokazuje rzeczywistą pracę systemu (labor illusion): bieżącą czynność,
 * postęp i trwały dziennik. Ukończone etapy nie znikają — zostają z zieloną fajką.
 */
export function ProgressSteps({ steps }: { steps: ProgressStep[] }) {
  return (
    <ol className="flex flex-col" aria-live="polite">
      {steps.map((step, i) => (
        <li key={step.id} className="relative flex gap-3 pb-5 last:pb-0">
          {i < steps.length - 1 && (
            <span className={cn("absolute top-6 left-[9.5px] h-[calc(100%-1.5rem)] w-px", step.state === "done" ? "bg-success/60" : "bg-border")} aria-hidden />
          )}
          <span className="relative z-10 mt-0.5 shrink-0 bg-background">
            <StepIcon state={step.state} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className={cn("text-sm font-medium", step.state === "pending" && "text-muted-foreground")}>
              {step.title} <span className="sr-only">— {stateLabel[step.state]}</span>
            </p>
            {step.state === "running" && step.current && <p className="text-xs text-muted-foreground">{step.current}</p>}
            {step.state === "running" && step.progress && step.progress.total > 1 && (
              <Progress value={(step.progress.done / step.progress.total) * 100} className="h-1.5" aria-label={`${step.title}: ${step.progress.done} z ${step.progress.total}`} />
            )}
            {step.summary && step.state !== "running" && (
              <p className={cn("text-xs", step.state === "error" ? "text-destructive" : step.state === "done" ? "text-success" : "text-muted-foreground")}>{step.summary}</p>
            )}
            {!!step.details?.length && (
              <ul className="mt-1 flex max-h-40 flex-col gap-0.5 overflow-y-auto text-xs text-muted-foreground">
                {step.details.map((d, j) => (
                  <li key={j} className="flex gap-1.5">
                    {d.status === "ok" ? (
                      <CheckIcon className="mt-0.5 size-3 shrink-0 text-success" aria-hidden />
                    ) : d.status === "error" ? (
                      <XIcon className="mt-0.5 size-3 shrink-0 text-destructive" aria-hidden />
                    ) : (
                      <MinusIcon className="mt-0.5 size-3 shrink-0" aria-hidden />
                    )}
                    <span className="break-words">{d.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
