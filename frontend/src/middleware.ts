import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    // Usuario con Google que todavía no creó su estudio → setup
    if (token?.needsStudio && pathname !== "/setup-studio") {
      return NextResponse.redirect(new URL("/setup-studio", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/expedientes/:path*",
    "/clientes/:path*",
    "/vencimientos/:path*",
    // /dev/autologin queda fuera — no requiere auth
  ],
};
