import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest } from "next/server";

const handler = NextAuth(authOptions);

async function wrappedHandler(req: NextRequest, ctx: { params: { nextauth: string[] } }) {
  try {
    return await handler(req as any, ctx as any);
  } catch (err: unknown) {
    console.error("[NextAuth Fatal]", err instanceof Error ? err.stack : String(err));
    throw err;
  }
}

export { wrappedHandler as GET, wrappedHandler as POST };
