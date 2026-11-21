/** Bramka hasła witryny. Hasło trzymamy wyłącznie w zmiennej SITE_PASSWORD (Vercel / .env.local). */
export const SITE_COOKIE = "rm_access";

const encoder = new TextEncoder();

/** Token ciasteczka = SHA-256(hasło + sól). Zmiana hasła unieważnia wszystkie sesje. */
export async function accessToken(password: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`riskminer:${password}`));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const sitePassword = () => process.env.SITE_PASSWORD ?? "";
