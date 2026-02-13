import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const UK_COUNTRY_CODES = new Set(["GB", "UK"]);

function getCountryCode(req: NextRequest) {
  return (
    req.headers.get("x-vercel-ip-country") ||
    req.headers.get("cf-ipcountry") ||
    ""
  )
    .trim()
    .toUpperCase();
}

export function middleware(req: NextRequest) {
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  if (req.nextUrl.pathname.startsWith("/uk-only")) {
    return NextResponse.next();
  }

  const countryCode = getCountryCode(req);

  if (countryCode && UK_COUNTRY_CODES.has(countryCode)) {
    return NextResponse.next();
  }

  const isApiRequest = req.nextUrl.pathname.startsWith("/api/");

  if (isApiRequest) {
    return NextResponse.json(
      { error: "This service is only available in the UK." },
      { status: 403 }
    );
  }

  const url = req.nextUrl.clone();
  url.pathname = "/uk-only";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};