import {
  ClipboardCheckIcon,
  DatabaseIcon,
  FileStackIcon,
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

/** Dolny pasek na telefonie mieści najwyżej 5 pozycji — kolejne są tylko w pasku bocznym na desktopie. */
export const MOBILE_NAV_LIMIT = 5;

/** Nawigacja główna: sidebar na desktopie (wszystkie pozycje) i dolny pasek na telefonie (pierwsze 5). */
export const navItems: NavItem[] = [
  { title: "Pulpit", href: "/dashboard", icon: LayoutDashboardIcon },
  { title: "Nowa inwestycja", href: "/assessments/new", icon: ClipboardCheckIcon },
  { title: "Zapisane oceny", href: "/assessments", icon: FileStackIcon },
  { title: "Zrealizowane inwestycje", href: "/projects", icon: FolderKanbanIcon },
  { title: "Weryfikacja", href: "/review", icon: ListChecksIcon },
  { title: "Modele", href: "/llm", icon: ScaleIcon },
  { title: "Baza porównawcza", href: "/reference", icon: DatabaseIcon },
];

/** Ścieżki dostępne bez hasła witryny. */
export const publicPaths = ["/haslo"];
