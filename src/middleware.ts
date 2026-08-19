import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/server/auth/session-constants";
import { SITE_PATHNAME_HEADER } from "@/lib/sites/paths";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/api/demo",
  "/api/mcp",
  "/_next",
  "/favicon.ico",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => {
    if (p === "/") return pathname === "/";
    return pathname === p || pathname.startsWith(`${p}/`);
  });
}

function next(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(SITE_PATHNAME_HEADER, request.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

function sessionSecret(): Uint8Array | null {
  const raw =
    process.env.SESSION_SECRET?.trim() ||
    process.env.APP_MASTER_KEY?.trim() ||
    "";
  if (!raw) return null;
  return new TextEncoder().encode(raw);
}

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  const secret = sessionSecret();
  if (!secret) return false;
  try {
    const { payload } = await jwtVerify(token, secret);
    return typeof payload.userId === "string" && !!payload.userId;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/.test(pathname)
  ) {
    return next(request);
  }

  const authed = await hasValidSession(request);

  if (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/verify-email"
  ) {
    if (authed && pathname !== "/verify-email") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return next(request);
  }

  if (pathname === "/" || isPublic(pathname)) {
    return next(request);
  }

  if (!authed) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return next(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
