import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database, UserRole } from "@/types/database";

const ROLE_HOME: Record<UserRole, string> = {
  super_admin: "/super-admin",
  vendor_admin: "/vendor",
  data_entry: "/branch",
  accountant: "/branch/accountant",
  principal: "/branch/accountant",
};

function isPublicPath(path: string) {
  return (
    path === "/" ||
    path.startsWith("/login") ||
    path.startsWith("/parent") ||
    path.startsWith("/api/cron")
  );
}

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Missing env must never 500 the whole deployment (common on first Vercel deploy).
  if (!supabaseUrl || !supabaseKey) {
    if (isPublicPath(path)) {
      return NextResponse.next({ request });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "config");
    return NextResponse.redirect(url);
  }

  try {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient<Database>(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user && !isPublicPath(path)) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", path);
      return NextResponse.redirect(url);
    }

    if (user && (path === "/" || path.startsWith("/login"))) {
      const { data: profile } = await supabase
        .from("app_users")
        .select("role, status")
        .eq("id", user.id)
        .maybeSingle();

      const url = request.nextUrl.clone();
      if (!profile || profile.status !== "active") {
        url.pathname = "/login";
        url.searchParams.set("error", "inactive");
        return NextResponse.redirect(url);
      }
      url.pathname = ROLE_HOME[profile.role];
      return NextResponse.redirect(url);
    }

    if (user) {
      const { data: profile } = await supabase
        .from("app_users")
        .select("role, status")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile || profile.status !== "active") {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        return NextResponse.redirect(url);
      }

      if (path.startsWith("/super-admin") && profile.role !== "super_admin") {
        const url = request.nextUrl.clone();
        url.pathname = ROLE_HOME[profile.role];
        return NextResponse.redirect(url);
      }

      if (
        path.startsWith("/vendor") &&
        !["super_admin", "vendor_admin"].includes(profile.role)
      ) {
        const url = request.nextUrl.clone();
        url.pathname = ROLE_HOME[profile.role];
        return NextResponse.redirect(url);
      }
    }

    return supabaseResponse;
  } catch (error) {
    console.error("[middleware]", error);
    // Fail open for public routes so the landing/login pages still render.
    if (isPublicPath(path)) {
      return NextResponse.next({ request });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "session");
    return NextResponse.redirect(url);
  }
}
