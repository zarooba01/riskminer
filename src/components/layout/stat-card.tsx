import { TrendingDownIcon, TrendingUpIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string;
  icon?: LucideIcon;
  /** Zmiana względem poprzedniego okresu, np. "+12%". */
  change?: string;
  trend?: "up" | "down";
  hint?: string;
  /** Mały skrót na dole kafla, np. „Zobacz projekty →”. */
  link?: { href: string; label: string };
};

export function StatCard({ label, value, icon: Icon, change, trend, hint, link }: StatCardProps) {
  const TrendIcon = trend === "down" ? TrendingDownIcon : TrendingUpIcon;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {Icon && <Icon className="size-4 text-muted-foreground" aria-hidden />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {(change || hint) && (
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            {change && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-medium",
                  trend === "down" ? "text-destructive" : "text-foreground",
                )}
              >
                {trend && <TrendIcon className="size-3" aria-hidden />}
                {change}
              </span>
            )}
            {hint}
          </p>
        )}
      </CardContent>
      {link && (
        <div className="mt-auto px-(--card-spacing)">
          <Link href={link.href} className="text-xs font-medium text-primary underline-offset-4 hover:underline">
            {link.label}
          </Link>
        </div>
      )}
    </Card>
  );
}
