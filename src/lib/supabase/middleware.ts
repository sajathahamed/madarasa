import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database, UserRole } from "@/types/database";

import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

const ROLE_HOME: Record<UserRole, string> = {
  super_admin: "/super-admin",
  vendor_admin: "/vendor",
  data_entry: "/branch",
  accountant: "/branch",
  principal: "/branch",
};

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
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
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthPage = path.startsWith("/login");
  const isPublic =
    path === "/" || isAuthPage || path.startsWith("/api/cron");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && (path === "/" || isAuthPage)) {
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
}
