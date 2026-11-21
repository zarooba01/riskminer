import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

/** Pusta strona bazowa: zaznaczone strefy, w które trafia treść ekranu. Punkt wyjścia dla nowych ekranów. */
export function BasePageView({ title = "Tytuł strony" }: { title?: string }) {
  const zone = "flex items-center justify-center rounded-xl border border-dashed bg-muted/40 text-sm text-muted-foreground";

  return (
    <>
      <PageHeader
        title={title}
        description="Krótki opis tego, co użytkownik zrobi na tej stronie."
        actions={<Button>Akcja główna</Button>}
      />
      <div className="grid gap-4 md:grid-cols-3">
        {["Kafelek 1", "Kafelek 2", "Kafelek 3"].map((label) => (
          <div key={label} className={`${zone} h-28`}>
            {label}
          </div>
        ))}
      </div>
      <div className={`${zone} min-h-72 flex-1`}>Treść strony</div>
    </>
  );
}
