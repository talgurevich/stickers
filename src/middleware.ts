import { NextRequest, NextResponse } from "next/server";

// PayPlus POSTs the user back to the success/failure URLs (carries the
// transaction details in a self-submitting form). Next.js page routes only
// answer GET, so we intercept POST → 303 redirect to the same URL with the
// query string preserved.
export function middleware(req: NextRequest) {
  if (req.method !== "POST") return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (pathname === "/payment/success" || pathname === "/payment/failure") {
    return NextResponse.redirect(req.nextUrl, { status: 303 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/payment/success", "/payment/failure"],
};
