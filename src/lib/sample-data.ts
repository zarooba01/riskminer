/** Dane przykładowe dla ekranów-wzorców i Storybooka. Zastąp zapytaniami do Supabase. */
export type RecordStatus = "nowe" | "w toku" | "zamknięte";

export type SampleRecord = {
  id: string;
  title: string;
  owner: string;
  status: RecordStatus;
  updatedAt: string;
  description: string;
};

export const sampleRecords: SampleRecord[] = [
  { id: "R-1042", title: "Zgłoszenie awarii oświetlenia", owner: "Anna Nowak", status: "nowe", updatedAt: "2026-11-18", description: "Nie działa oświetlenie na odcinku ulicy między dwoma skrzyżowaniami." },
  { id: "R-1041", title: "Wniosek o dostęp do danych", owner: "Piotr Zieliński", status: "w toku", updatedAt: "2026-11-17", description: "Prośba o udostępnienie zestawienia za trzeci kwartał." },
  { id: "R-1040", title: "Aktualizacja rejestru", owner: "Maria Wiśniewska", status: "w toku", updatedAt: "2026-11-17", description: "Uzupełnienie brakujących pozycji po przeglądzie." },
  { id: "R-1039", title: "Przegląd okresowy", owner: "Tomasz Kamiński", status: "zamknięte", updatedAt: "2026-11-15", description: "Przegląd zakończony bez uwag." },
  { id: "R-1038", title: "Zgłoszenie uszkodzonej nawierzchni", owner: "Anna Nowak", status: "zamknięte", updatedAt: "2026-11-14", description: "Ubytek w nawierzchni naprawiony przez ekipę terenową." },
  { id: "R-1037", title: "Prośba o konsultację", owner: "Katarzyna Lewandowska", status: "nowe", updatedAt: "2026-11-13", description: "Mieszkaniec prosi o kontakt w sprawie planowanej inwestycji." },
];

export const statusVariant: Record<RecordStatus, "default" | "secondary" | "outline"> = {
  nowe: "default",
  "w toku": "secondary",
  zamknięte: "outline",
};

/** Dane przykładowe makiety strony bazowej (nagłówek + lewy panel). */
export type SampleNavItem = { title: string; href: string; icon: string; badge?: string };
export type SampleNavSection = { label: string; items: SampleNavItem[] };

export const sampleNavigation: SampleNavSection[] = [
  {
    label: "Główne",
    items: [
      { title: "Pulpit", href: "/dashboard", icon: "dashboard" },
      { title: "Rekordy", href: "/records", icon: "list", badge: "12" },
      { title: "Mapa", href: "/map", icon: "map" },
      { title: "Raporty", href: "/reports", icon: "chart" },
    ],
  },
  {
    label: "Administracja",
    items: [
      { title: "Użytkownicy", href: "/users", icon: "users" },
      { title: "Dokumenty", href: "/documents", icon: "file", badge: "3" },
      { title: "Ustawienia", href: "/settings", icon: "settings" },
    ],
  },
];

export const sampleUser = { name: "Anna Nowak", email: "anna.nowak@example.com", role: "Administrator" };
