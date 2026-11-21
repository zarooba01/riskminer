import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { publicPaths } from "@/lib/config";

import { supabaseConfigured, supabaseKey, supabaseUrl } from "./env";

const authPages = ["/login", "/register", "/forgot-password"];

function isPublic(pathname: string) {
  return publicPaths.some((path) => pathname === path || (path !== "/" && pathname.startsWith(`${path}/`)));
}

/** Odświeża sesję Supabase i pilnuje dostępu: niezalogowani trafiają na /login. */
export async function updateSession(request: NextRequest) {
  if (!supabaseConfigured) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!user && !isPublic(pathname)) return redirectTo("/login");
  if (user && authPages.includes(pathname)) return redirectTo("/dashboard");

  return response;
}
