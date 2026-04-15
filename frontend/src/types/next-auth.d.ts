import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      studioId: string;
      role: string;
      backendToken: string;
      needsStudio: boolean;
    } & DefaultSession["user"];
  }
}
