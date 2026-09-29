import { NextResponse, type NextRequest } from "next/server";
import { LOCALES, negotiateLocale } from "@/lib/i18n";

/**
 * Sends visitors without a language in the URL to /en or /es, based on their
 * browser language. The URL then carries the choice (no cookies needed), and
 * the language switcher simply links to the other prefix.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasLocale = LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
  if (hasLocale) return;

  const locale = negotiateLocale(request.headers.get("accept-language"));
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next internals and files with an extension (icon.svg, etc.).
  matcher: ["/((?!_next|.*\\..*).*)"],
};
