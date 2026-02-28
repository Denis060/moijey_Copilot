import type { NextAuthConfig } from "next-auth";

export const authConfig = {
    pages: {
        signIn: "/login",
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.role = (user as any).role;
                token.workspace_id = (user as any).workspace_id;
            }
            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
                (session.user as any).id = token.sub;
                (session.user as any).role = token.role as string;
                (session.user as any).workspace_id = token.workspace_id as string;
            }
            return session;
        },
    },
    providers: [], // Configured in auth.ts
    trustHost: true,
} satisfies NextAuthConfig;
