import { Avatar, Button, Chip, Drawer, SearchField } from "@heroui/react";
import {
  BarChart3Icon,
  BellIcon,
  CircleHelpIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  ListIcon,
  MapIcon,
  MenuIcon,
  SettingsIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import type { SampleNavSection } from "@sample-data";

import { Logo } from "../logo";

const icons: Record<string, LucideIcon> = {
  dashboard: LayoutDashboardIcon,
  list: ListIcon,
  map: MapIcon,
  chart: BarChart3Icon,
  users: UsersIcon,
  file: FileTextIcon,
  settings: SettingsIcon,
};

type BaseLayoutProps = {
  navigation: SampleNavSection[];
  user: { name: string; email: string };
  /** Ścieżka aktywnej pozycji menu. */
  activeHref?: string;
  notifications?: number;
  children: ReactNode;
};

function NavLink({ icon: Icon, title, badge, active }: { icon: LucideIcon; title: string; badge?: string; active?: boolean }) {
  return (
    <a
      href="#"
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
        active ? "bg-accent-soft text-accent-soft-foreground" : "text-foreground hover:bg-default"
      }`}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="flex-1 truncate">{title}</span>
      {badge && (
        <Chip size="sm" variant="soft" color={active ? "accent" : "default"}>
          {badge}
        </Chip>
      )}
    </a>
  );
}

function Navigation({ navigation, activeHref }: Pick<BaseLayoutProps, "navigation" | "activeHref">) {
  return (
    <nav aria-label="Nawigacja główna" className="flex h-full flex-col gap-4 p-3">
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
        {navigation.map((section) => (
          <div key={section.label} className="flex flex-col gap-1">
            <p className="px-3 py-1 text-xs font-medium text-muted">{section.label}</p>
            {section.items.map((item) => (
              <NavLink
                key={item.href}
                icon={icons[item.icon] ?? ListIcon}
                title={item.title}
                badge={item.badge}
                active={item.href === activeHref}
              />
            ))}
          </div>
        ))}
      </div>
      <NavLink icon={CircleHelpIcon} title="Pomoc" />
    </nav>
  );
}

/**
 * Strona bazowa w HeroUI: nagłówek na całą szerokość + lewy panel.
 * HeroUI nie ma gotowego komponentu panelu bocznego — panel to zwykły układ na tokenach HeroUI,
 * a na telefonie nawigacja otwiera się w komponencie Drawer.
 */
export function BaseLayout({ navigation, user, activeHref = "/dashboard", notifications = 0, children }: BaseLayoutProps) {
  const [open, setOpen] = useState(true);
  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .join("");

  return (
    <div className="flex h-svh flex-col bg-background-secondary">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-3 md:px-4">
        <Button isIconOnly variant="ghost" aria-label="Pokaż lub ukryj menu" className="hidden md:inline-flex" onPress={() => setOpen(!open)}>
          <MenuIcon className="size-5" />
        </Button>
        <div className="md:hidden">
          <Drawer>
            <Button isIconOnly variant="ghost" aria-label="Otwórz menu">
              <MenuIcon className="size-5" />
            </Button>
            <Drawer.Backdrop>
              <Drawer.Content placement="left">
                <Drawer.Dialog aria-label="Menu" className="w-72 p-0">
                  <Drawer.Body className="p-0">
                    <Navigation navigation={navigation} activeHref={activeHref} />
                  </Drawer.Body>
                </Drawer.Dialog>
              </Drawer.Content>
            </Drawer.Backdrop>
          </Drawer>
        </div>
        <Logo />
        <div className="flex-1" />
        <SearchField name="search" aria-label="Szukaj w aplikacji" className="hidden w-72 sm:flex">
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Szukaj…" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        <span className="relative">
          <Button isIconOnly variant="ghost" aria-label={`Powiadomienia: ${notifications}`}>
            <BellIcon className="size-5" />
          </Button>
          {notifications > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-4 font-medium text-danger-foreground">
              {notifications}
            </span>
          )}
        </span>
        <Avatar size="sm" color="accent">
          <Avatar.Fallback>{initials}</Avatar.Fallback>
        </Avatar>
        <span className="hidden text-sm font-medium lg:inline">{user.name}</span>
      </header>

      <div className="flex min-h-0 flex-1">
        {open && (
          <aside className="hidden w-64 shrink-0 border-r border-border bg-background md:block">
            <Navigation navigation={navigation} activeHref={activeHref} />
          </aside>
        )}
        <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

/** Pusta strona: zaznaczone strefy, w które trafia treść ekranu. */
export function BasePagePlaceholder() {
  const zone = "flex items-center justify-center rounded-2xl border border-dashed border-border bg-default/40 text-sm text-muted";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tytuł strony</h1>
        <p className="mt-1 text-sm text-muted">Krótki opis tego, co użytkownik zrobi na tej stronie.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {["Kafelek 1", "Kafelek 2", "Kafelek 3"].map((label) => (
          <div key={label} className={`${zone} h-28`}>
            {label}
          </div>
        ))}
      </div>
      <div className={`${zone} min-h-80`}>Treść strony</div>
    </div>
  );
}
