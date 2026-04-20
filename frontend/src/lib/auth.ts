import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

// NEXT_PUBLIC_API_URL es para el browser (client-side).
// En server-side (dentro del container) necesitamos la URL interna de Docker.
const API_URL =
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/calendar.events",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),

    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const res = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          if (!res.ok) return null;

          const data = await res.json();
          return {
            id: data.user_id,
            email: data.email,
            name: data.full_name,
            studioId: data.studio_id,
            role: data.role,
            backendToken: data.access_token,
          };
        } catch {
          return null;
        }
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      // Google OAuth: sincronizar con backend
      if (account?.provider === "google") {
        try {
          const res = await fetch(`${API_URL}/auth/google`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: user.email,
              name: user.name,
              google_id: user.id,
              google_refresh_token: account.refresh_token,
            }),
          });
          if (!res.ok) return false;

          const data = await res.json();
          // Enriquecemos el user con datos del backend
          (user as any).studioId = data.studio_id;
          (user as any).role = data.role;
          (user as any).backendToken = data.access_token;
          (user as any).needsStudio = data.needs_studio;
        } catch {
          return false;
        }
      }
      return true;
    },

    async jwt({ token, user, account }) {
      if (user) {
        token.userId = user.id;
        token.studioId = (user as any).studioId;
        token.role = (user as any).role;
        token.backendToken = (user as any).backendToken;
        token.needsStudio = (user as any).needsStudio;
      }
      if (account?.provider) {
        token.authProvider = account.provider;
      }
      if (account?.provider === "google") {
        token.googleRefreshToken = account.refresh_token;
      }
      return token;
    },

    async session({ session, token }) {
      (session.user as any).id = token.userId as string;
      session.user.studioId = token.studioId as string;
      session.user.role = token.role as string;
      session.user.backendToken = token.backendToken as string;
      session.user.needsStudio = token.needsStudio as boolean;
      (session.user as any).authProvider = token.authProvider as string;
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
};
