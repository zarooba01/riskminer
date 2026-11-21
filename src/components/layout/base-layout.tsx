"use client";

import {
  BarChart3Icon,
  BellIcon,
  CircleHelpIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  ListIcon,
  LogOutIcon,
  MapIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import type { SampleNavSection } from "@/lib/sample-data";

import { initials, isActive } from "./app-sidebar";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

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
  user: { name: string; email: string; role?: string };
  /** Liczba nieprzeczytanych powiadomień przy dzwonku. */
  notifications?: number;
  /** Panel rozwinięty przy starcie (desktop). */
  defaultOpen?: boolean;
  onSignOut?: () => void;
  children: React.ReactNode;
};

/**
 * Strona bazowa: nagłówek z logo na całą szerokość, pod nim lewy panel nawigacyjny i treść.
 * Na bazie bloku shadcn sidebar-16. Poniżej `md` panel otwiera się jako wysuwana szuflada.
 */
export function BaseLayout({ navigation, user, notifications = 0, defaultOpen = true, onSignOut, children }: BaseLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="[--header-height:calc(--spacing(14))]">
      <SidebarProvider defaultOpen={defaultOpen} className="flex flex-col">
        <header className="sticky top-0 z-50 flex h-(--header-height) w-full shrink-0 items-center gap-2 border-b bg-background px-3 md:px-4">
          <SidebarTrigger aria-label="Pokaż lub ukryj menu" />
          <Link href="/" className="mr-2">
            <Logo />
          </Link>
          <div className="relative ml-auto hidden w-full max-w-xs sm:block">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input type="search" placeholder="Szukaj…" aria-label="Szukaj w aplikacji" className="pl-9" />
          </div>
          <div className="ml-auto flex items-center gap-1 sm:ml-0">
            <Button variant="ghost" size="icon" className="relative" aria-label={`Powiadomienia: ${notifications}`}>
              <BellIcon />
              {notifications > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 font-medium text-primary-foreground">
                  {notifications}
                </span>
              )}
            </Button>
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-1.5" aria-label="Menu użytkownika">
                  <Avatar className="size-7">
                    <AvatarFallback className="text-xs">{initials(user.name)}</AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm font-medium lg:inline">{user.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-56">
                <DropdownMenuLabel className="font-normal">
                  <span className="block truncate font-medium">{user.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {user.role ? `${user.role} · ` : ""}
                    {user.email}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <SettingsIcon /> Ustawienia
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSignOut?.()}>
                  <LogOutIcon /> Wyloguj się
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="flex flex-1">
          <Sidebar collapsible="icon" className="top-(--header-height) h-[calc(100svh-var(--header-height))]!">
            <SidebarContent>
              {navigation.map((section) => (
                <SidebarGroup key={section.label}>
                  <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {section.items.map((item) => {
                        const Icon = icons[item.icon] ?? ListIcon;
                        return (
                          <SidebarMenuItem key={item.href}>
                            <SidebarMenuButton asChild isActive={isActive(pathname, item.href)} tooltip={item.title}>
                              <Link href={item.href}>
                                <Icon />
                                <span>{item.title}</span>
                              </Link>
                            </SidebarMenuButton>
                            {item.badge && <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>}
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              ))}
            </SidebarContent>
            <SidebarFooter>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Pomoc">
                    <Link href="/help">
                      <CircleHelpIcon />
                      <span>Pomoc</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarFooter>
            <SidebarRail />
          </Sidebar>
          <SidebarInset>
            <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">{children}</main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}
