import { NextResponse, type NextRequest } from "next/server";

import { publicPaths } from "@/lib/config";
import { accessToken, SITE_COOKIE, sitePassword } from "@/lib/site-password";

/** Bez SITE_PASSWORD (np. lokalnie) witryna jest otwarta. Z hasłem — każda trasa poza /haslo wymaga ciasteczka. */
export async function proxy(request: NextRequest) {
  const password = sitePassword();
  if (!password) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return NextResponse.next();

  if (request.cookies.get(SITE_COOKIE)?.value === (await accessToken(password))) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Wymagane hasło dostępu." }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/haslo";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)"],
};
