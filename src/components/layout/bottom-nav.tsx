"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { MOBILE_NAV_LIMIT, navItems } from "@/lib/config";
import { cn } from "@/lib/utils";

import { isActive } from "./app-sidebar";

/** Dolna nawigacja na telefonie — zastępuje sidebar poniżej breakpointu `md`. */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Nawigacja główna"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="flex">
        {navItems.slice(0, MOBILE_NAV_LIMIT).map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground transition-colors",
                  active && "text-primary",
                )}
              >
                <item.icon className="size-5" aria-hidden />
                {item.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
