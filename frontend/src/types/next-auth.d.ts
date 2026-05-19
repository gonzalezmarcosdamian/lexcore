import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      studioId: string;
      role: string;
      backendToken: string;
      needsStudio: boolean;
      authProvider?: string;
    } & DefaultSession["user"];
  }

  interface User {
    backendToken?: string;
    studioId?: string;
    role?: string;
    needsStudio?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    studioId?: string;
    role?: string;
    backendToken?: string;
    backendTokenIssuedAt?: number;
    needsStudio?: boolean;
    authProvider?: string;
    googleRefreshToken?: string;
    googleAccessToken?: string;
    googleAccessTokenExpires?: number;
  }
}
