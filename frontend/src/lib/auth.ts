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
          scope: "openid email profile",
          access_type: "offline",
          prompt: "select_account",
        },
      },
      checks: ["state"],
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
        token.backendTokenIssuedAt = Date.now();
        token.needsStudio = (user as any).needsStudio;
      }
      if (account?.provider) {
        token.authProvider = account.provider;
      }
      if (account?.provider === "google") {
        token.googleRefreshToken = account.refresh_token;
      }
      // Renovar backendToken si quedan menos de 7 días (expira a los 30)
      const issuedAt = (token.backendTokenIssuedAt as number) ?? 0;
      const age = Date.now() - issuedAt;
      const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
      const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
      if (issuedAt && age > THIRTY_DAYS - SEVEN_DAYS && token.backendToken) {
        try {
          const API_URL = process.env.NEXTAUTH_URL
            ? process.env.NEXTAUTH_URL.replace(":3001", ":8000").replace("3001", "8000")
            : process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
          const res = await fetch(`${API_URL}/auth/refresh`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token.backendToken}` },
          });
          if (res.ok) {
            const data = await res.json();
            token.backendToken = data.access_token;
            token.backendTokenIssuedAt = Date.now();
          }
        } catch {
          // Si falla el refresh, el token existente sigue siendo válido por varios días más
        }
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

  // v2
  logger: {
    error(code, metadata) {
      const err = (metadata as any)?.error;
      const msg = err?.message || err?.name || (metadata instanceof Error ? metadata.message : JSON.stringify(metadata));
      console.error("[NextAuth Error]", code, msg);
    },
    warn(code) {
      console.warn("[NextAuth Warn]", code);
    },
  },

  cookies: {
    state: {
      name: "__Secure-next-auth.state",
      options: {
        httpOnly: true,
        sameSite: "none" as const,
        path: "/",
        secure: true,
      },
    },
    pkceCodeVerifier: {
      name: "__Secure-next-auth.pkce.code_verifier",
      options: {
        httpOnly: true,
        sameSite: "none" as const,
        path: "/",
        secure: true,
      },
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 }, // 30 días
  secret: process.env.NEXTAUTH_SECRET,
};
