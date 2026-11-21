export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Bez kluczy aplikacja działa w trybie demo: ekrany są dostępne, logowanie jest wyłączone. */
export const supabaseConfigured = Boolean(supabaseUrl && supabaseKey);
