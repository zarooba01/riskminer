import type { Metadata } from "next";

import { Logo } from "@/components/layout/logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Dostęp" };

export default async function PasswordPage({ searchParams }: PageProps<"/haslo">) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <Logo className="mb-2" />
          <CardTitle>Prototyp chroniony hasłem</CardTitle>
          <CardDescription>Wersja konkursowa HackNation 2026. Podaj hasło otrzymane od zespołu.</CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm next={typeof next === "string" ? next : "/dashboard"} />
        </CardContent>
      </Card>
    </main>
  );
}
