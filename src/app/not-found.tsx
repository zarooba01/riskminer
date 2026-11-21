import { CompassIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CompassIcon />
          </EmptyMedia>
          <EmptyTitle>Nie ma takiej strony</EmptyTitle>
          <EmptyDescription>Adres jest nieprawidłowy albo strona została przeniesiona.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href="/">Wróć na stronę główną</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
