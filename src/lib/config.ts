import {
  FileDownIcon,
  FolderKanbanIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  ScaleIcon,
  type LucideIcon,
} from "lucide-react";

/** Jedno miejsce na nazwę projektu. */
export const appConfig = {
  name: "Risk Miner",
  shortName: "Risk Miner",
  description: "Inteligentna baza doświadczeń inwestycji publicznych — sektor wodno-kanalizacyjny (pilotaż MFiPR).",
  themeColor: "#1f4fd8",
};

/** Konta użytkowników są na razie wyłączone (patrz README → „Dostęp”). */
export const mfaEnabled = false;

export type NavItem = { title: string; href: string; icon: LucideIcon };

/** Nawigacja główna: sidebar na desktopie i dolny pasek na telefonie (maks. 5 pozycji). */
export const navItems: NavItem[] = [
  { title: "Pulpit", href: "/dashboard", icon: LayoutDashboardIcon },
  { title: "Projekty", href: "/projects", icon: FolderKanbanIcon },
  { title: "Weryfikacja", href: "/review", icon: ListChecksIcon },
  { title: "Modele", href: "/llm", icon: ScaleIcon },
  { title: "Eksport", href: "/export", icon: FileDownIcon },
];

/** Ścieżki dostępne bez hasła witryny. */
export const publicPaths = ["/haslo"];
