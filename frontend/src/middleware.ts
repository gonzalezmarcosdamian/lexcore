import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    // Usuario que todavía no creó su estudio → setup
    if (token?.needsStudio && pathname !== "/setup-studio") {
      return NextResponse.redirect(new URL("/setup-studio", req.url));
    }

    // Usuario con studio ya configurado no debe ver /setup-studio
    if (!token?.needsStudio && pathname === "/setup-studio") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
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
    "/movimientos/:path*",
    "/setup-studio",
    // /dev/autologin queda fuera — no requiere auth
  ],
};
