"use client";

import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { plural, type ActionResult } from "@/lib/rm/format";

type Props = { projectCount: number; clearAction: () => Promise<ActionResult> };

/** „Wyczyść dane” z potwierdzeniem — operacja nieodwracalna, okno nie zamyka się w trakcie usuwania. */
export function ClearDataButton({ projectCount, clearAction }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const confirm = () =>
    start(async () => {
      const result = await clearAction();
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        router.refresh();
      } else toast.error(result.message);
    });

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" className="text-destructive hover:text-destructive" disabled={!projectCount}>
          <Trash2Icon /> Wyczyść dane
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Wyczyścić wszystkie dane inwestycji?</AlertDialogTitle>
          <AlertDialogDescription>
            Zostanie usuniętych {plural(projectCount, ["inwestycja", "inwestycje", "inwestycji"])} razem z dopasowaniami, ogłoszeniami, umowami, zdarzeniami, decyzjami
            ekspertów i przebiegami AI. Katalog ryzyk zostanie. Tej operacji nie można cofnąć.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Anuluj</AlertDialogCancel>
          <Button variant="destructive" onClick={confirm} disabled={pending}>
            {pending ? <Spinner /> : <Trash2Icon />} Usuń wszystko
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
