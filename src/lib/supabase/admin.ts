import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { supabaseUrl } from "./env";

const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const databaseConfigured = Boolean(supabaseUrl && secretKey);

// Schemat rm_* nie jest generowany do typów (prototyp) — wiersze rzutujemy na typy z src/lib/rm/types.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: SupabaseClient<any> | undefined;

/** Klient serwerowy z kluczem sekretnym (omija RLS). Nigdy nie importuj go w komponentach klienckich. */
export function db() {
  if (!databaseConfigured) {
    throw new Error("Brak konfiguracji bazy: ustaw NEXT_PUBLIC_SUPABASE_URL i SUPABASE_SECRET_KEY (patrz README).");
  }
  client ??= createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
