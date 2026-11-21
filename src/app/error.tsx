"use client";

import { TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlertIcon />
          </EmptyMedia>
          <EmptyTitle>Coś poszło nie tak</EmptyTitle>
          <EmptyDescription>Spróbuj ponownie. Jeśli błąd wraca, odśwież stronę.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={reset}>Spróbuj ponownie</Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
