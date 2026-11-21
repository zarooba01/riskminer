"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { accessToken, SITE_COOKIE, sitePassword } from "@/lib/site-password";

export type PasswordState = { error?: string };

export async function unlock(_: PasswordState, formData: FormData): Promise<PasswordState> {
  const password = sitePassword();
  const given = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  if (!password || given !== password) return { error: "Nieprawidłowe hasło." };

  (await cookies()).set(SITE_COOKIE, await accessToken(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}
