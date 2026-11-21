"use client";

import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

import { AppSidebar, type ShellUser } from "./app-sidebar";
import { BottomNav } from "./bottom-nav";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

type AppShellProps = {
  user: ShellUser;
  onSignOut?: () => void;
  /** Pasek informacyjny nad treścią, np. „tryb demo”. */
  banner?: React.ReactNode;
  children: React.ReactNode;
};

/** Powłoka części chronionej: sidebar na desktopie, górny pasek i dolna nawigacja na telefonie. */
export function AppShell({ user, onSignOut, banner, children }: AppShellProps) {
  return (
    <SidebarProvider>
      <div className="hidden md:contents">
        <AppSidebar user={user} onSignOut={onSignOut} />
      </div>
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1 hidden md:inline-flex" aria-label="Zwiń lub rozwiń menu" />
          <Separator orientation="vertical" className="mr-2 hidden data-vertical:h-4 data-vertical:self-auto md:block" />
          <Logo className="md:hidden" />
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        {banner}
        <main className="flex flex-1 flex-col gap-6 p-4 pb-24 md:p-6 md:pb-6">{children}</main>
      </SidebarInset>
      <BottomNav />
    </SidebarProvider>
  );
}
