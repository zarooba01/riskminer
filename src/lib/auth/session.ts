import { cache } from "react";

export type SessionUser = { id: string; email: string; name: string; demo: boolean };

/**
 * Konta użytkowników są na razie wyłączone — dostęp chroni hasło witryny (`src/proxy.ts`).
 * Funkcja zostaje jako punkt zaczepienia: po włączeniu Supabase Auth wróci tu sprawdzanie sesji.
 */
export const requireUser = cache(async (): Promise<SessionUser> => {
  return { id: "expert", email: "", name: "Ekspert", demo: false };
});
